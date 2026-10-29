import type { Plan } from "@mi-desorden/core";

type Limites = Pick<Plan, "max_inventarios" | "max_productos" | "max_personas">;

/** "5", o "Sin límite" si el límite es null. */
export const textoLimite = (n: number | null) =>
  n === null ? "Sin límite" : n.toLocaleString("es");

/** "1 inventario · 100 productos · 2 personas", para listas. */
export function resumenLimites(p: Limites): string {
  const parte = (n: number | null, uno: string, varios: string) =>
    n === null ? `${varios} sin límite` : `${n.toLocaleString("es")} ${n === 1 ? uno : varios}`;
  return [
    parte(p.max_inventarios, "inventario", "inventarios"),
    parte(p.max_productos, "producto", "productos"),
    parte(p.max_personas, "persona", "personas"),
  ].join(" · ");
}

/** "$9,99 / mes", o "Gratis" en 0 y "—" si no tiene precio cargado. */
export function textoPrecio(precio: number | null): string {
  if (precio === null) return "—";
  if (precio === 0) return "Gratis";
  return `$${precio.toLocaleString("es", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} / mes`;
}

/** Convierte el texto de un campo numérico: vacío = sin límite (null), inválido = undefined. */
export function leerLimite(texto: string): number | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 ? n : undefined;
}

/** Cuánto del cupo se usó: lleno al llegar al límite, cerca desde el 80 %. Sin límite, siempre libre. */
export function nivelCupo(usados: number, max: number | null): "libre" | "cerca" | "lleno" {
  if (max === null) return "libre";
  if (usados >= max) return "lleno";
  return usados >= max * 0.8 ? "cerca" : "libre";
}
