import type { Producto } from "@mi-desorden/core";

/** Fotos por producto: la principal y 2 más. Con 3 desde distintos ángulos el reconocimiento acierta más. */
export const MAX_FOTOS = 3;
/** Con una sola foto el reconocimiento anda, pero con 2 o más mejora bastante. */
export const FOTOS_RECOMENDADAS = 2;

type ConFotos = Pick<Producto, "foto_path" | "fotos_extra">;

/** Todas las rutas del producto, la principal primero. */
export function rutasDe(p: ConFotos): string[] {
  return [...(p.foto_path ? [p.foto_path] : []), ...(p.fotos_extra ?? [])];
}

/** Cuántas fotos más se le pueden agregar. */
export const lugaresLibres = (cantidad: number) => Math.max(0, MAX_FOTOS - cantidad);

/** "2 de 3 fotos" (o "1 de 3 fotos"). */
export const textoFotos = (cantidad: number) => `${cantidad} de ${MAX_FOTOS} fotos`;

/**
 * Tras quitar `ruta`: la nueva principal y las extras. Si se quita la principal,
 * la primera extra pasa a serlo (las rutas no cambian: no hay que mover archivos).
 */
export function sinFoto(
  p: ConFotos,
  ruta: string,
): { foto_path: string | null; fotos_extra: string[] } {
  if (p.foto_path === ruta) {
    const [primera, ...resto] = p.fotos_extra ?? [];
    return { foto_path: primera ?? null, fotos_extra: resto };
  }
  return { foto_path: p.foto_path, fotos_extra: (p.fotos_extra ?? []).filter((r) => r !== ruta) };
}
