/** Reglas del perfil: las mismas que valida la base (migración perfil_personalizable). */

export const NOMBRE_MIN = 2;
export const NOMBRE_MAX = 60;

/** Lado de la foto de perfil: se ve como mucho a 96 pt, así que 512 px sobra en cualquier pantalla. */
export const LADO_AVATAR = 512;

/** El nombre sin espacios de más. */
export const limpiarNombre = (nombre: string) => nombre.trim().replace(/\s+/g, " ");

/** Texto del problema con el nombre, o null si está bien. */
export function errorNombre(nombre: string): string | null {
  const n = limpiarNombre(nombre).length;
  if (n < NOMBRE_MIN) return `El nombre necesita al menos ${NOMBRE_MIN} letras.`;
  if (n > NOMBRE_MAX) return `El nombre puede tener hasta ${NOMBRE_MAX} caracteres.`;
  return null;
}

/** El teléfono sin espacios de más; vacío → null (no lo cargó). */
export function limpiarTelefono(telefono: string): string | null {
  const t = telefono.trim().replace(/\s+/g, " ");
  return t ? t : null;
}

/** Texto del problema con el teléfono, o null si está bien (vacío también está bien). */
export function errorTelefono(telefono: string): string | null {
  const t = limpiarTelefono(telefono);
  if (t === null) return null;
  if (!/^\+?[0-9 ()-]+$/.test(t))
    return "El teléfono solo puede tener números, espacios, guiones y un + al inicio.";
  const digitos = t.replace(/\D/g, "").length;
  if (digitos < 7 || t.length > 20)
    return "Revisa el teléfono: parece incompleto o demasiado largo.";
  return null;
}

/**
 * Número para wa.me: solo dígitos y con código de país. "+58 412…" y "0058 412…" ya lo
 * traen; un número local con 0 adelante ("0412…") se toma como de Venezuela (58).
 * Devuelve null si no queda un número usable.
 */
export function numeroWhatsApp(telefono: string, pais = "58"): string | null {
  const t = telefono.trim();
  let digitos = t.replace(/\D/g, "");
  if (t.startsWith("+")) {
    // ya es internacional
  } else if (digitos.startsWith("00")) digitos = digitos.slice(2);
  else if (digitos.startsWith("0")) digitos = pais + digitos.slice(1);
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}
