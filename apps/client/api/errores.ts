import { ApiError } from "@mi-desorden/core";

/** Pasa cualquier error del backend (Supabase o la API de Nest) a un texto para mostrar. */
export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) {
    // Errores del usuario (permiso, datos): la API ya manda el texto para mostrar.
    if ([400, 403, 404, 409, 422].includes(e.status) && e.detalle) return e.detalle;
    if (e.status === 401) return "Tu sesión venció. Vuelve a iniciar sesión.";
    if (e.status === 429) return "Demasiados intentos. Espera unos minutos.";
    if (e.status >= 500) return "El servidor tuvo un problema. Prueba de nuevo.";
  }
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
  if (/user is banned|user_banned/i.test(msg)) {
    return "Tu cuenta está suspendida. Escríbele al soporte de MI DESORDEN.";
  }
  if (/email not confirmed/i.test(msg)) return "Confirma tu correo antes de entrar.";
  if (/user already registered/i.test(msg)) return "Ya hay una cuenta con ese correo.";
  if (/password should be at least/i.test(msg)) return "La contraseña es muy corta.";
  if (/should be different from the old password/i.test(msg)) {
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  }
  if (/weak password|password is known to be weak|pwned/i.test(msg)) {
    return "Esa contraseña es muy común o fue filtrada. Elige otra.";
  }
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Espera un minuto.";
  if (/token has expired or is invalid|otp.*(expired|invalid)/i.test(msg))
    return "El código es inválido o venció. Pide uno nuevo.";
  if (/only request this after (\d+) seconds/i.test(msg)) {
    return `Espera ${msg.match(/after (\d+) seconds/i)![1]} segundos antes de pedir otro correo.`;
  }
  if (/error sending (confirmation|recovery|magic link)? ?email|smtp/i.test(msg)) {
    return "No se pudo enviar el correo. Revisa la configuración de SMTP en Supabase.";
  }
  if (/link is invalid or has expired|otp_expired|access_denied/i.test(msg)) {
    return "El enlace venció o ya se usó. Pide otro correo o usa el código.";
  }
  if (/code verifier|invalid flow state|auth code/i.test(msg)) {
    return "Abre el enlace en el mismo teléfono donde te registraste, o usa el código del correo.";
  }
  if (/categorias_nombre_unico/i.test(msg)) return "Ya hay una categoría con ese nombre.";
  if (/violates foreign key constraint.*(categoria|categorias_padre)/i.test(msg)) {
    return "La categoría todavía tiene productos o subcategorías adentro.";
  }
  if (/network|fetch/i.test(msg)) return "Sin conexión. Revisa tu internet.";
  return msg;
}

/** Tira un Error con el mensaje ya traducido si la respuesta de Supabase trae error. */
export function siFalla(error: unknown) {
  if (error) throw new Error(mensajeError(error));
}

/** La API no está o falló (red o 5xx): no es un error del usuario. */
export function servidorNoDisponible(e: unknown): boolean {
  if (e instanceof ApiError) return e.status >= 500;
  const msg = (e as { message?: string })?.message ?? String(e);
  return /network|fetch|timeout|abort/i.test(msg);
}
