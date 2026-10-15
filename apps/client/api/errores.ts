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
  if (/password should contain/i.test(msg)) {
    return "La contraseña necesita al menos una mayúscula y un carácter especial.";
  }
  if (/should be different from the old password/i.test(msg)) {
    return "La contraseña nueva tiene que ser distinta de la anterior.";
  }
  if (/weak password|password is known to be weak|pwned/i.test(msg)) {
    return "Esa contraseña es muy común o fue filtrada. Elegí otra.";
  }
  if (/rate limit/i.test(msg)) return "Demasiados intentos. Esperá un minuto.";
  if (/token has expired or is invalid|otp.*(expired|invalid)/i.test(msg))
    return "El código es inválido o venció. Pedí uno nuevo.";
  if (/only request this after (\d+) seconds/i.test(msg)) {
    return `Esperá ${msg.match(/after (\d+) seconds/i)![1]} segundos antes de pedir otro correo.`;
  }
  if (/error sending (confirmation|recovery|magic link)? ?email|smtp/i.test(msg)) {
    return "No se pudo enviar el correo. Revisá la configuración de SMTP en Supabase.";
  }
  if (/link is invalid or has expired|otp_expired|access_denied/i.test(msg)) {
    return "El enlace venció o ya se usó. Pedí otro correo o usá el código.";
  }
  if (/code verifier|invalid flow state|auth code/i.test(msg)) {
    return "Abrí el enlace en el mismo teléfono donde te registraste, o usá el código del correo.";
  }
  if (/categorias_nombre_unico/i.test(msg)) return "Ya hay una categoría con ese nombre.";
  if (/violates foreign key constraint.*(categoria|categorias_padre)/i.test(msg)) {
    return "La categoría todavía tiene productos o subcategorías adentro.";
  }
  if (/network|fetch/i.test(msg)) return "Sin conexión. Revisá tu internet.";
  return msg;
}

/** Tira un Error con el mensaje ya traducido si la respuesta de Supabase trae error. */
export function siFalla(error: unknown) {
  if (error) throw new Error(mensajeError(error));
}
