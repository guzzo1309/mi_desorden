import type { Producto } from "@mi-desorden/core";

type ConStock = Pick<Producto, "cantidad" | "minimo">;

/** Quedó por debajo del mínimo que se definió (un mínimo de 0 no avisa nunca). */
export const esPorReponer = (p: ConStock) => p.cantidad < p.minimo;

/** Cuánto falta para llegar al mínimo (0 si no falta). */
export const faltante = (p: ConStock) => Math.max(0, p.minimo - p.cantidad);

/**
 * Los que hay que reponer, del más urgente al menos: primero los agotados y
 * después los que más les falta. A igual urgencia, por nombre.
 */
export function porReponer<T extends ConStock & Pick<Producto, "nombre">>(productos: T[]): T[] {
  return productos
    .filter(esPorReponer)
    .sort(
      (a, b) =>
        Number(b.cantidad === 0) - Number(a.cantidad === 0) ||
        faltante(b) - faltante(a) ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
}

/** "3 productos por reponer · 1 agotado", para el aviso. */
export function textoAvisoStock(reponer: number, agotados: number): string {
  const base = `${reponer} ${reponer === 1 ? "producto por reponer" : "productos por reponer"}`;
  return agotados > 0 ? `${base} · ${agotados} ${agotados === 1 ? "agotado" : "agotados"}` : base;
}
