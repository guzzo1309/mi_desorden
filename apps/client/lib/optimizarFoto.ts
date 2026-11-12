import { File, Paths } from "expo-file-system";
import { productos as productosApi } from "@/api";
import { BYTES_FOTO_PESADA, convieneReemplazar, ESCALONES_OPTIMIZAR } from "@/lib/fotos";
import { reducirFoto } from "@/lib/imagen";
import { crearLog, tamano, type Log } from "@/lib/log";

/** Bytes reales de un base64 (sin el relleno "="). */
const bytesDe = (base64: string) =>
  Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);

/**
 * Baja una foto de Storage, la achica y la vuelve a subir en la misma ruta. Prueba
 * los escalones de ESCALONES_OPTIMIZAR hasta que quede por debajo del umbral de
 * "pesada"; si ninguno llega, sube la más liviana que haya salido. Si no se pudo
 * achicar nada, no la toca.
 *
 * Cada paso deja un log de desarrollo para saber en cuál falla.
 */
export async function optimizarFoto(ruta: string, log: Log = crearLog("optimizar")): Promise<void> {
  log.info(`${ruta}: pidiendo URL firmada`);
  const url = await productosApi.urlFoto(ruta);
  const destino = new File(Paths.cache, `optimizar-${Date.now()}.jpg`);
  try {
    log.info(`${ruta}: bajando`);
    const bajada = await File.downloadFileAsync(url, destino);
    const original = bajada.size ?? 0;
    log.info(`${ruta}: bajada ${tamano(original)}`);

    let mejor: string | null = null;
    for (const { ancho, calidad } of ESCALONES_OPTIMIZAR) {
      const { base64 } = await reducirFoto(bajada.uri, ancho, calidad);
      const bytes = bytesDe(base64);
      log.info(`${ruta}: ${ancho}px · ${calidad} → ${tamano(bytes)}`);
      if (!mejor || bytes < bytesDe(mejor)) mejor = base64;
      if (bytes <= BYTES_FOTO_PESADA) break;
    }

    if (!mejor || !convieneReemplazar(original, bytesDe(mejor))) {
      log.warn(`${ruta}: no se pudo achicar más, queda como está`);
      return;
    }
    log.info(`${ruta}: subiendo ${tamano(bytesDe(mejor))}`);
    await productosApi.reemplazarFoto(ruta, mejor);
    log.info(`${ruta}: reemplazada`);
  } finally {
    try {
      destino.delete();
    } catch {
      // Si no se puede borrar el temporal, el sistema lo limpia solo.
    }
  }
}
