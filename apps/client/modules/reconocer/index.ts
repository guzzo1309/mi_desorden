import { requireOptionalNativeModule } from "expo";
import type { BloqueTexto } from "@/lib/factura";

export interface Analisis {
  /** Producto → distancia visual a su foto de referencia (menor = más parecido). */
  distancias: Record<string, number>;
  /** Líneas de texto que se leen en la foto (marca, nombre, tamaño…). */
  textos: string[];
}

interface ModuloReconocer {
  /** Cambia cuando cambia cómo se calcula la huella: las guardadas de otra versión no sirven. */
  huellaVersion?: number;
  /** Huella visual de una imagen (file:// o https), en base64. */
  huella(uri: string): Promise<string>;
  analizar(uri: string, referencias: Record<string, string>): Promise<Analisis>;
  /** Todo el texto de una imagen (ej. una factura), cada pedazo con su caja. */
  leerTexto(uri: string): Promise<BloqueTexto[]>;
}

/**
 * Apple Vision en el teléfono. Null en Android, web o en una build vieja que
 * todavía no tiene el módulo: la cámara lo avisa en vez de romperse.
 */
export const Reconocer = requireOptionalNativeModule<ModuloReconocer>("Reconocer");
