import { ApiError } from "@mi-desorden/core";

/** Pasa cualquier error del backend (Supabase o la API de Nest) a un texto para mostrar. */
export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Tu sesión venció. Volvé a iniciar sesión.";
    if (e.status === 429) return "Demasiados intentos. Esperá unos minutos.";
    if (e.status >= 500) return "El servidor tuvo un problema. Probá de nuevo.";
  }
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(msg)) return "Confirmá tu correo antes de entrar.";
  if (/user already registered/i.test(msg)) return "Ya hay una cuenta con ese correo.";
  if (/password should be at least/i.test(msg)) return "La contraseña es muy corta.";
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Esperá un minuto.";
  if (/network|fetch/i.test(msg)) return "Sin conexión. Revisá tu internet.";
  return msg;
}

/** Tira un Error con el mensaje ya traducido si la respuesta de Supabase trae error. */
export function siFalla(error: unknown) {
  if (error) throw new Error(mensajeError(error));
}
