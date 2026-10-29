import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Ancho de las fotos de productos. La cámara saca 12 MP (varios MB): para
 * reconocer el producto y mostrar miniaturas alcanza de sobra con 900 px, y la
 * foto pesa ~100 KB en vez de ~2 MB, así sube, baja y se analiza mucho más rápido.
 */
export const ANCHO_FOTO = 900;
const CALIDAD = 0.6;

/** Achica una foto (respeta la orientación) y la devuelve como JPEG con su base64. */
export async function reducirFoto(
  uri: string,
  ancho = ANCHO_FOTO,
): Promise<{ uri: string; base64: string }> {
  const imagen = await ImageManipulator.manipulate(uri).resize({ width: ancho }).renderAsync();
  const resultado = await imagen.saveAsync({
    compress: CALIDAD,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!resultado.base64) throw new Error("No se pudo preparar la foto. Prueba de nuevo.");
  return { uri: resultado.uri, base64: resultado.base64 };
}
