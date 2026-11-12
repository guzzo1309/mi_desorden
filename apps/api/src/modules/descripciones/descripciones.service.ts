import { randomUUID } from "node:crypto";
import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { DescripcionIa, UsoIa } from "@mi-desorden/core";
import type { UsuarioSesion } from "../../shared/auth/usuario.decorator";
import type { Env } from "../../shared/config/env";
import type { PedirDescripcionDto } from "./dto/pedir-descripcion.dto";
import {
  alcanza,
  armarPrompt,
  cercaDelLimite,
  ESQUEMA_RESPUESTA,
  INSTRUCCIONES,
  leerRespuesta,
} from "./ia";

interface RespuestaGemini {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    totalTokenCount?: number;
  };
}

/**
 * La IA escribe o mejora la descripción de un producto.
 *
 * 1. El permiso (usar_ia, solo el owner) lo decide la base con el token de quien llama.
 * 2. La cuota del mes se lee y se descuenta con la service key: la app no puede tocarla.
 * 3. Si el modelo falla no se cobra nada.
 *
 * La API no guarda la descripción: la devuelve como sugerencia y el owner decide
 * si la usa y guarda el producto (con los permisos normales de productos).
 */
@Injectable()
export class DescripcionesService {
  private readonly logger = new Logger(DescripcionesService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async pedir(
    usuario: UsuarioSesion,
    token: string,
    dto: PedirDescripcionDto,
  ): Promise<DescripcionIa> {
    const clave = this.config.get("GEMINI_API_KEY", { infer: true });
    const servicio = this.config.get("SUPABASE_SERVICE_ROLE_KEY", { infer: true });
    if (!clave || !servicio) {
      throw new ServiceUnavailableException("La IA todavía no está configurada");
    }

    const inicio = Date.now();
    const tiempos: string[] = [];
    const marca = (paso: string) => tiempos.push(`${paso} ${Date.now() - inicio}ms`);

    // 1 y 2. Permiso, producto y cuota a la vez: son independientes y cada uno es un
    // viaje a Supabase. Si alguno falla, se responde con el primero que corresponda.
    const maxSalida = this.config.get("IA_MAX_SALIDA", { infer: true });
    const [puede, esDelInventario, antes] = await Promise.all([
      this.puedeUsarIa(token, dto.inventario_id),
      dto.producto_id
        ? this.productoEsDe(token, dto.producto_id, dto.inventario_id)
        : Promise.resolve(true),
      this.rpc<UsoIa>(servicio, "ia_cuota", { p_usuario: usuario.id }),
    ]);
    marca("chequeos");
    // 1. Solo quien tiene usar_ia en ese inventario (el owner).
    if (!puede) throw new ForbiddenException("Solo el owner del inventario puede usar la IA");
    if (!esDelInventario) throw new NotFoundException("Ese producto no está en el inventario");
    // 2. ¿Le queda cuota este mes?
    if (!alcanza(antes, maxSalida)) {
      throw new HttpException(
        "Llegaste al límite de IA de tu plan este mes. Se renueva el día 1 o puedes pedir un plan más grande.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // 3. El modelo.
    const modelo = this.config.get("IA_MODELO", { infer: true });
    const { texto, entrada, salida } = await this.llamarModelo(clave, modelo, maxSalida, dto);
    marca(`modelo (${entrada}+${salida} tokens)`);
    const respuesta = leerRespuesta(texto, dto.categorias ?? []);

    // 4. Se cobra lo que gastó (aunque la respuesta no sirva: los tokens se usaron).
    const uso = await this.rpc<UsoIa>(servicio, "ia_registrar", {
      p_usuario: usuario.id,
      p_inventario: dto.inventario_id,
      p_producto: dto.producto_id ?? null,
      p_modo: dto.modo,
      p_modelo: modelo,
      p_entrada: entrada,
      p_salida: salida,
      p_clave: randomUUID(),
    });
    marca("cobro");
    this.logger.log(`Descripción (${dto.modo}): ${tiempos.join(" · ")}`);

    if (!respuesta) {
      throw new BadGatewayException("La IA no devolvió una descripción válida. Prueba de nuevo.");
    }
    return { ...respuesta, uso, cerca_del_limite: cercaDelLimite(uso) };
  }

  private async llamarModelo(
    clave: string,
    modelo: string,
    maxSalida: number,
    dto: PedirDescripcionDto,
  ): Promise<{ texto: string; entrada: number; salida: number }> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCCIONES }] },
        contents: [{ role: "user", parts: [{ text: armarPrompt(dto) }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: maxSalida,
          responseMimeType: "application/json",
          responseSchema: ESQUEMA_RESPUESTA,
          // Sin "pensar": para un texto corto no hace falta y gastaría tokens.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);

    if (!res) throw new BadGatewayException("No se pudo hablar con la IA. Prueba de nuevo.");
    if (res.status === 429) {
      throw new ServiceUnavailableException("La IA está ocupada. Prueba en un minuto.");
    }
    if (!res.ok) {
      // Sin el cuerpo: puede repetir el prompt.
      this.logger.warn(`Gemini respondió ${res.status}`);
      throw new BadGatewayException("La IA no pudo escribir la descripción. Prueba de nuevo.");
    }

    const cuerpo = (await res.json().catch(() => ({}))) as RespuestaGemini;
    const texto = (cuerpo.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const meta = cuerpo.usageMetadata ?? {};
    const entrada = meta.promptTokenCount ?? 0;
    const salida =
      meta.totalTokenCount != null
        ? Math.max(meta.totalTokenCount - entrada, 0)
        : (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0);
    return { texto, entrada, salida };
  }

  /** puede(inv, 'usar_ia') con el token de quien llama: la base decide. */
  private async puedeUsarIa(token: string, inventario: string): Promise<boolean> {
    const res = await fetch(`${this.supabaseUrl()}/rest/v1/rpc/puede`, {
      method: "POST",
      headers: this.cabeceras(this.anon(), token),
      body: JSON.stringify({ inv: inventario, permiso: "usar_ia" }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) {
      this.logger.warn(`Supabase respondió ${res?.status ?? "sin respuesta"} al ver el permiso`);
      throw new BadGatewayException("No se pudo verificar tu permiso");
    }
    return (await res.json()) === true;
  }

  /** El producto existe, lo veo (RLS) y es de ese inventario. */
  private async productoEsDe(token: string, producto: string, inventario: string) {
    const url = new URL(`${this.supabaseUrl()}/rest/v1/productos`);
    url.searchParams.set("select", "id");
    url.searchParams.set("id", `eq.${producto}`);
    url.searchParams.set("inventario_id", `eq.${inventario}`);
    const res = await fetch(url, {
      headers: this.cabeceras(this.anon(), token),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) throw new BadGatewayException("No se pudo leer el producto");
    return ((await res.json()) as unknown[]).length > 0;
  }

  /** Funciones de la cuota: solo con la service key. */
  private async rpc<T>(servicio: string, funcion: string, cuerpo: object): Promise<T> {
    const res = await fetch(`${this.supabaseUrl()}/rest/v1/rpc/${funcion}`, {
      method: "POST",
      headers: this.cabeceras(servicio, servicio),
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) {
      this.logger.warn(`Supabase respondió ${res?.status ?? "sin respuesta"} en ${funcion}`);
      throw new BadGatewayException("No se pudo leer tu uso de IA");
    }
    return (await res.json()) as T;
  }

  private supabaseUrl() {
    return this.config.get("SUPABASE_URL", { infer: true });
  }

  private anon() {
    return this.config.get("SUPABASE_ANON_KEY", { infer: true });
  }

  private cabeceras(apikey: string, bearer: string) {
    return { apikey, Authorization: `Bearer ${bearer}`, "Content-Type": "application/json" };
  }
}
