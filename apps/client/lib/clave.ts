/**
 * Reglas de contraseña para cuentas nuevas y para cambiarla (criterio del
 * Sprint 1): al menos 8 caracteres, 1 mayúscula y 1 carácter especial.
 * Supabase tiene que tener la misma política (Authentication → Providers →
 * Email → Password requirements) para que no se pueda saltar desde la API.
 *
 * El login NO usa estas reglas: las cuentas viejas pueden tener claves de 6.
 */

export const MINIMO_CLAVE = 8;

const REGLAS = [
  { ok: (c: string) => c.length >= MINIMO_CLAVE, falta: `${MINIMO_CLAVE} caracteres` },
  { ok: (c: string) => /\p{Lu}/u.test(c), falta: "una mayúscula" },
  { ok: (c: string) => /[^\p{L}\p{N}\s]/u.test(c), falta: "un carácter especial" },
] as const;

/** Lo que le falta a la contraseña, en orden. Vacío = cumple. */
export function faltantesClave(c: string): string[] {
  return REGLAS.filter((r) => !r.ok(c)).map((r) => r.falta);
}

export const claveCumple = (c: string) => faltantesClave(c).length === 0;

/** "Necesita 8 caracteres, una mayúscula y un carácter especial." */
export function textoFaltantes(c: string): string {
  const f = faltantesClave(c);
  if (!f.length) return "";
  const lista = f.length === 1 ? f[0] : `${f.slice(0, -1).join(", ")} y ${f[f.length - 1]}`;
  return `Necesita ${lista}.`;
}
