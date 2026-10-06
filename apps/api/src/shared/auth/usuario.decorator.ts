import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

/** Lo que el guard deja en la request después de verificar el JWT de Supabase. */
export interface UsuarioSesion {
  id: string;
  email: string | null;
  /** aal1 = contraseña, aal2 = con MFA. */
  aal: string | null;
  sesion_id: string | null;
  expira_en: string;
}

export type RequestConSesion = Request & { usuario?: UsuarioSesion };

/** `@UsuarioActual() usuario: UsuarioSesion` en cualquier ruta protegida. */
export const UsuarioActual = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<RequestConSesion>().usuario;
});
