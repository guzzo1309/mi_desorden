import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UsuarioSesion } from "../../shared/auth/usuario.decorator";
import type { Env } from "../../shared/config/env";
import type { CrearEmpleadoDto } from "./dto/crear-empleado.dto";

type FilaInventario = {
  id: string;
  nombre: string;
  miembros: { usuario_id: string; rol: { gestionar_accesos: boolean } | null }[];
};

export interface ResultadoEmpleado {
  /** false: ese correo ya tenía cuenta; se lo agregó sin tocar su contraseña. */
  creada: boolean;
  agregados: string[];
  errores: { inventario: string; mensaje: string }[];
}

/**
 * Crea la cuenta de un empleado con una contraseña temporal y lo agrega a los
 * inventarios del owner.
 *
 * La cuenta se crea con la service key (Auth admin), pero agregar al inventario
 * lo hace la propia persona que llama, con su token: así el rol de owner, el
 * límite del plan y el rol asignable los valida la base como siempre. Si no se
 * pudo agregar a ninguno, la cuenta recién creada se borra: no quedan cuentas huérfanas.
 */
@Injectable()
export class EmpleadosService {
  private readonly logger = new Logger(EmpleadosService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async crear(
    usuario: UsuarioSesion,
    token: string,
    dto: CrearEmpleadoDto,
  ): Promise<ResultadoEmpleado> {
    const servicio = this.config.get("SUPABASE_SERVICE_ROLE_KEY", { infer: true });
    if (!servicio) {
      throw new ServiceUnavailableException("La creación de cuentas no está configurada");
    }

    // 1. Quien llama tiene que poder gestionar accesos en cada inventario.
    const ids = [...new Set(dto.inventarios)];
    const filas = await this.leerInventarios(token, ids);
    for (const id of ids) {
      const inv = filas.find((f) => f.id === id);
      const gestiona = inv?.miembros.some(
        (m) => m.usuario_id === usuario.id && m.rol?.gestionar_accesos,
      );
      if (!inv || !gestiona) {
        throw new ForbiddenException("Tu rol no puede agregar gente a ese inventario");
      }
    }
    if (dto.email === usuario.email?.toLowerCase()) {
      throw new BadRequestException("Ese es tu propio correo");
    }

    // 2. La cuenta. Si el correo ya existe no se toca su contraseña: solo se lo agrega.
    const { id: nuevoId, existia } = await this.crearCuenta(servicio, dto);

    // 3. Agregarlo a cada inventario como el owner (RLS, límites y roles los valida la base).
    const resultados = await Promise.all(
      ids.map(async (id) => ({ id, error: await this.agregar(token, id, dto) })),
    );
    const agregados = resultados.filter((r) => !r.error).map((r) => r.id);
    const errores = resultados
      .filter((r) => r.error)
      .map((r) => ({
        inventario: filas.find((f) => f.id === r.id)?.nombre ?? r.id,
        mensaje: r.error!,
      }));

    // 4. Cuenta nueva y no entró a ningún inventario: no se deja huérfana.
    if (!existia && nuevoId && !agregados.length) {
      await this.borrarCuenta(servicio, nuevoId);
    }
    return { creada: !existia && agregados.length > 0, agregados, errores };
  }

  private async crearCuenta(
    servicio: string,
    dto: CrearEmpleadoDto,
  ): Promise<{ id: string | null; existia: boolean }> {
    const url = `${this.config.get("SUPABASE_URL", { infer: true })}/auth/v1/admin/users`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.cabeceras(servicio, servicio),
      body: JSON.stringify({
        email: dto.email,
        password: dto.clave,
        email_confirm: true,
        user_metadata: { nombre: dto.nombre },
        // Solo el servidor escribe app_metadata: el trigger de registro anota la clave temporal.
        app_metadata: { clave_temporal: true },
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (res?.ok) {
      const cuerpo = (await res.json()) as { id?: string };
      return { id: cuerpo.id ?? null, existia: false };
    }

    const cuerpo = (await res?.json().catch(() => null)) as {
      error_code?: string;
      msg?: string;
    } | null;
    if (cuerpo?.error_code === "email_exists" || cuerpo?.error_code === "user_already_exists") {
      return { id: null, existia: true };
    }
    if (cuerpo?.error_code === "weak_password") {
      throw new BadRequestException("Esa contraseña es muy débil o está filtrada. Elige otra.");
    }
    // Sin el cuerpo: puede repetir el correo o la contraseña.
    this.logger.warn(`Auth admin respondió ${res?.status ?? "sin respuesta"} al crear la cuenta`);
    throw new BadGatewayException("No se pudo crear la cuenta");
  }

  private async borrarCuenta(servicio: string, id: string) {
    const url = `${this.config.get("SUPABASE_URL", { infer: true })}/auth/v1/admin/users/${id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: this.cabeceras(servicio, servicio),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) this.logger.warn(`No se pudo borrar la cuenta huérfana ${id}`);
  }

  /** Devuelve null si salió bien, o el mensaje de la base. */
  private async agregar(token: string, inv: string, dto: CrearEmpleadoDto): Promise<string | null> {
    const url = `${this.config.get("SUPABASE_URL", { infer: true })}/rest/v1/rpc/invitar`;
    const res = await fetch(url, {
      method: "POST",
      headers: this.cabeceras(this.config.get("SUPABASE_ANON_KEY", { infer: true }), token),
      body: JSON.stringify({ inv, correo: dto.email, nuevo_rol: dto.rol }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (res?.ok) return null;
    const cuerpo = (await res?.json().catch(() => null)) as { message?: string } | null;
    return cuerpo?.message ?? "No se pudo agregar";
  }

  /** Lee los inventarios como el usuario que llama: RLS decide qué ve. */
  private async leerInventarios(token: string, ids: string[]): Promise<FilaInventario[]> {
    const url = new URL(`${this.config.get("SUPABASE_URL", { infer: true })}/rest/v1/inventarios`);
    url.searchParams.set("select", "id,nombre,miembros(usuario_id,rol:roles(gestionar_accesos))");
    url.searchParams.set("id", `in.(${ids.join(",")})`);
    const res = await fetch(url, {
      headers: this.cabeceras(this.config.get("SUPABASE_ANON_KEY", { infer: true }), token),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) {
      this.logger.warn(`Supabase respondió ${res?.status ?? "sin respuesta"} al leer inventarios`);
      throw new BadGatewayException("No se pudo verificar tu permiso");
    }
    return (await res.json()) as FilaInventario[];
  }

  private cabeceras(apikey: string, bearer: string) {
    return {
      apikey,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
    };
  }
}
