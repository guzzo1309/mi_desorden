import type { Paginado } from "@mi-desorden/core";

/** La forma en que la API devuelve cualquier lista: `{ items, total }`. */
export function paginar<T>(items: T[]): Paginado<T> {
  return { items, total: items.length };
}
