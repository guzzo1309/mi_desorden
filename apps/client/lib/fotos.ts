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

/**
 * ¿Ofrecer guardar la foto de la cámara como referencia del producto? Solo si
 * quien la sacó puede manejar fotos, el producto tiene lugar y además:
 *  - el modelo dudó y alguien lo corrigió (aprender de la corrección), o
 *  - el producto tiene pocas fotos (menos de FOTOS_RECOMENDADAS).
 */
export function ofrecerFotoDeCamara(
  p: ConFotos,
  { corregido, puedeFotos }: { corregido: boolean; puedeFotos: boolean },
): boolean {
  const n = rutasDe(p).length;
  return puedeFotos && n < MAX_FOTOS && (corregido || n < FOTOS_RECOMENDADAS);
}

/** Desde cuántos bytes una foto se considera pesada para una miniatura (las nuevas pesan ~100 KB). */
export const BYTES_FOTO_PESADA = 300_000;

/** Un archivo como lo devuelve la lista de Storage. */
export interface ArchivoStorage {
  name: string;
  metadata?: { size?: number } | null;
}

/** Las rutas (`inventario/nombre.jpg`) de las fotos que pesan más de `minBytes`, de la más pesada a la más liviana. */
export function rutasPesadas(
  archivos: ArchivoStorage[],
  inventarioId: string,
  minBytes = BYTES_FOTO_PESADA,
): string[] {
  return archivos
    .filter((a) => /\.jpe?g$/i.test(a.name) && (a.metadata?.size ?? 0) > minBytes)
    .sort((a, b) => (b.metadata?.size ?? 0) - (a.metadata?.size ?? 0))
    .map((a) => `${inventarioId}/${a.name}`);
}
