import type { Moneda } from "@mi-desorden/core";

/**
 * Precios de un producto (opcionales). Se escriben como en el teléfono: "12,50" o
 * "12.50", sin separador de miles. Se muestran con coma decimal, como en Venezuela.
 */

/** Lo escrito → número con 2 decimales, null si está vacío, o "invalido". */
export function leerPrecio(texto: string): number | null | "invalido" {
  const t = texto.trim().replace(/\s/g, "");
  if (!t) return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(t)) return "invalido";
  const n = Number(t.replace(",", "."));
  return n > 999_999_999_999 ? "invalido" : Math.round(n * 100) / 100;
}

/** Para mostrar y para editar: 1234.5 → "1.234,50" (con miles) o "1234,50" (sin). */
export function formatoPrecio(n: number, miles = true): string {
  const [entero, dec] = n.toFixed(2).split(".") as [string, string];
  const conMiles = miles ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : entero;
  return `${conMiles},${dec}`;
}

/** Símbolo de la moneda del inventario. */
export const simboloMoneda = (moneda: Moneda | undefined) => (moneda === "EUR" ? "€" : "$");

/** Precio con su moneda: "$1.234,50" o "€12,00". */
export const conMoneda = (n: number, moneda: Moneda | undefined) =>
  `${n < 0 ? "-" : ""}${simboloMoneda(moneda)}${formatoPrecio(Math.abs(n))}`;

/** Ganancia por unidad y su porcentaje sobre la compra (null si falta algún precio). */
export function margen(compra: number | null | undefined, venta: number | null | undefined) {
  if (compra == null || venta == null) return null;
  const ganancia = Math.round((venta - compra) * 100) / 100;
  const porcentaje = compra > 0 ? Math.round((ganancia / compra) * 1000) / 10 : null;
  return { ganancia, porcentaje };
}

/** "Ganancia por unidad: $7,50 (60 %)." o "Pérdida…"; null si falta algún precio. */
export function textoMargen(
  compra: number | null | undefined,
  venta: number | null | undefined,
  moneda: Moneda | undefined,
): string | null {
  const m = margen(compra, venta);
  if (!m) return null;
  const pct = m.porcentaje == null ? "" : ` (${String(m.porcentaje).replace(".", ",")} %)`;
  return `${m.ganancia < 0 ? "Pérdida" : "Ganancia"} por unidad: ${conMoneda(Math.abs(m.ganancia), moneda)}${pct}.`;
}
