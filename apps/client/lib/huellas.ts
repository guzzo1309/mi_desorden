import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Producto } from "@mi-desorden/core";
import { productos as productosApi } from "@/api";
import { rutasDe } from "@/lib/fotos";
import { Reconocer } from "@/modules/reconocer";

/**
 * Huellas visuales de las fotos de los productos, guardadas en el teléfono.
 * Un producto puede tener hasta 3 fotos y cada una tiene su huella. Se calculan
 * una vez por foto (bajarla y pasarla por Vision lleva ~1 s). No se usa
 * actualizado_en (cambia con cada ajuste de stock): cuando la app cambia una
 * foto, llama a olvidarHuella.
 */

// La versión viene del módulo nativo: si cambia cómo se calcula la huella (por ejemplo, al
// aislar el objeto del fondo), las guardadas dejan de servir y se rehacen solas.
const CLAVE = `mi_desorden:huellas-v${Reconocer?.huellaVersion ?? 1}`;

/** ruta de la foto → huella. */
type Guardadas = Record<string, string>;
let cache: Record<string, Guardadas> | null = null;

async function leer() {
  if (cache) return cache;
  try {
    cache = JSON.parse((await AsyncStorage.getItem(CLAVE)) ?? "{}");
  } catch {
    cache = {};
  }
  return cache!;
}

/** La foto de este producto cambió (o se quitó): su huella se rehace la próxima vez. Sin ruta, todas. */
export async function olvidarHuella(productoId: string, ruta?: string) {
  const guardadas = await leer();
  const del = guardadas[productoId];
  if (!del) return;
  if (ruta) delete del[ruta];
  else delete guardadas[productoId];
  await AsyncStorage.setItem(CLAVE, JSON.stringify(guardadas)).catch(() => {});
}

/**
 * Devuelve producto → huellas de todas sus fotos. Calcula las que faltan (de a
 * una, para no saturar) y avisa el progreso.
 */
export async function huellasDe(
  productos: Producto[],
  progreso?: (hechas: number, total: number) => void,
): Promise<Record<string, string[]>> {
  const guardadas = await leer();
  const conFoto = productos.filter((p) => rutasDe(p).length);
  const faltan = conFoto.flatMap((p) =>
    rutasDe(p)
      .filter((ruta) => !guardadas[p.id]?.[ruta])
      .map((ruta) => ({ id: p.id, ruta })),
  );

  if (Reconocer && faltan.length) {
    let hechas = 0;
    progreso?.(0, faltan.length);
    for (const f of faltan) {
      try {
        const url = await productosApi.urlFoto(f.ruta);
        (guardadas[f.id] ??= {})[f.ruta] = await Reconocer.huella(url);
      } catch {
        // Una foto que no baja no frena las demás: se usan las otras o el texto.
      }
      progreso?.(++hechas, faltan.length);
    }
    // Las rutas que ya no están en el producto se descartan.
    for (const p of conFoto) {
      const vigentes = new Set(rutasDe(p));
      for (const ruta of Object.keys(guardadas[p.id] ?? {})) {
        if (!vigentes.has(ruta)) delete guardadas[p.id]![ruta];
      }
    }
    AsyncStorage.setItem(CLAVE, JSON.stringify(guardadas)).catch(() => {});
  }

  const salida: Record<string, string[]> = {};
  for (const p of conFoto) {
    const hs = rutasDe(p)
      .map((ruta) => guardadas[p.id]?.[ruta])
      .filter((h): h is string => !!h);
    if (hs.length) salida[p.id] = hs;
  }
  return salida;
}
