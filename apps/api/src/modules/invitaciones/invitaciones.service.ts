import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../shared/config/env";
import type { UsuarioSesion } from "../../shared/auth/usuario.decorator";
import { asuntoInvitacion, htmlInvitacion, textoInvitacion } from "./correo";

type FilaInventario = {
  id: string;
  nombre: string;
  miembros: {
    usuario_id: string;
    /** rol_id → roles: el permiso que hace falta para invitar. */
    rol: { gestionar_accesos: boolean } | null;
    perfiles: { nombre: string; email: string } | null;
  }[];
  invitaciones: { email: string }[];
};

/**
 * Manda el correo de invitación. La invitación en sí la hace la app con
 * invitar() en Supabase; acá solo se avisa, y solo si de verdad existe: quien
 * llama tiene que poder gestionar accesos en cada inventario y el correo tiene que estar
 * invitado ahí (como miembro o pendiente). Así esto no sirve para mandar spam.
 */
@Injectable()
export class InvitacionesService {
  private readonly logger = new Logger(InvitacionesService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async avisar(usuario: UsuarioSesion, token: string, email: string, ids: string[]) {
    const resend = this.config.get("RESEND_API_KEY", { infer: true });
    if (!resend) throw new ServiceUnavailableException("El envío de correos no está configurado");

    const unicos = [...new Set(ids)];
    const filas = await this.leerInventarios(token, unicos);

    const invitados = unicos.map((id) => {
      const inv = filas.find((f) => f.id === id);
      const gestiono = inv?.miembros.some(
        (m) => m.usuario_id === usuario.id && m.rol?.gestionar_accesos,
      );
      if (!inv || !gestiono) {
        throw new ForbiddenException("Tu rol no puede avisar de una invitación");
      }
      const esMiembro = inv.miembros.some((m) => m.perfiles?.email === email);
      const pendiente = inv.invitaciones.some((i) => i.email === email);
      if (!esMiembro && !pendiente) {
        throw new ForbiddenException(`${email} no está invitado a “${inv.nombre}”`);
      }
      return { inv, pendiente: !esMiembro };
    });

    const yo = filas[0]?.miembros.find((m) => m.usuario_id === usuario.id)?.perfiles;
    const pendiente = invitados.every((i) => i.pendiente);
    const primero = invitados[0]!.inv.id;
    const datos = {
      quien: yo?.nombre || usuario.email || "Alguien",
      inventarios: invitados.map((i) => i.inv.nombre),
      pendiente,
      email,
      enlace: `${this.config.get("API_PUBLIC_URL", { infer: true })}/api/v1/invitaciones/abrir?inv=${primero}${pendiente ? "&registro=1" : ""}`,
    };

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resend}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.config.get("MAIL_FROM", { infer: true }),
        to: [email],
        reply_to: usuario.email ?? undefined,
        subject: asuntoInvitacion(datos),
        html: htmlInvitacion(datos),
        text: textoInvitacion(datos),
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    if (!res?.ok) {
      // Sin el cuerpo: Resend puede repetir la dirección del destinatario.
      this.logger.warn(`Resend respondió ${res?.status ?? "sin respuesta"}`);
      throw new BadGatewayException("No se pudo mandar el correo de invitación");
    }
    return { enviado: true, pendiente };
  }

  /** Lee los inventarios como el usuario que llama: RLS decide qué ve. */
  private async leerInventarios(token: string, ids: string[]): Promise<FilaInventario[]> {
    const url = new URL(`${this.config.get("SUPABASE_URL", { infer: true })}/rest/v1/inventarios`);
    url.searchParams.set(
      "select",
      "id,nombre,miembros(usuario_id,rol:roles(gestionar_accesos),perfiles(nombre,email)),invitaciones(email)",
    );
    url.searchParams.set("id", `in.(${ids.join(",")})`);
    const clave = this.config.get("SUPABASE_ANON_KEY", { infer: true });

    const res = await fetch(url, {
      headers: { apikey: clave, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!res?.ok) {
      this.logger.warn(`Supabase respondió ${res?.status ?? "sin respuesta"} al leer inventarios`);
      throw new BadGatewayException("No se pudo verificar la invitación");
    }
    return (await res.json()) as FilaInventario[];
  }
}
