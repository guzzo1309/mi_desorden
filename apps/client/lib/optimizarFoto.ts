import { File, Paths } from "expo-file-system";
import { productos as productosApi } from "@/api";
import { reducirFoto } from "@/lib/imagen";

/**
 * Baja una foto de Storage, la achica (~900 px, ~100 KB) y la vuelve a subir en la
 * misma ruta. El aspecto no cambia: solo pesa mucho menos.
 */
export async function optimizarFoto(ruta: string): Promise<void> {
  const url = await productosApi.urlFoto(ruta);
  const destino = new File(Paths.cache, `optimizar-${Date.now()}.jpg`);
  try {
    const bajada = await File.downloadFileAsync(url, destino);
    const { base64 } = await reducirFoto(bajada.uri);
    await productosApi.reemplazarFoto(ruta, base64);
  } finally {
    try {
      destino.delete();
    } catch {
      // Si no se puede borrar el temporal, el sistema lo limpia solo.
    }
  }
}
