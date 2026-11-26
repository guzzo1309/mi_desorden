import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

/**
 * iOS y Android: escribe el PDF en la caché y abre la hoja de compartir del sistema,
 * desde donde se guarda en Archivos / Descargas, se manda por correo, etc.
 * (En web lo reemplaza guardarPdf.web.ts, que lo descarga directo.)
 */
export async function guardarPdf(bytes: Uint8Array, nombre: string): Promise<void> {
  if (!nombre.toLowerCase().endsWith(".pdf")) throw new Error("Solo se descargan archivos .pdf");
  const archivo = new File(Paths.cache, nombre);
  if (archivo.exists) archivo.delete();
  archivo.create();
  archivo.write(bytes);
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Este dispositivo no permite compartir archivos.");
  }
  await Sharing.shareAsync(archivo.uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: "Balance administrativo",
  });
}