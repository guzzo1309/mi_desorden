import type { Detection, DetectionInput } from "@mi-desorden/core";
import { http } from "./http";

/** Lo que reconoce la cámara del teléfono, guardado en la API de Nest. */
export const detecciones = {
  async listar(inventarioId?: string): Promise<Detection[]> {
    return (await http.detections(inventarioId)).items;
  },

  async registrar(input: DetectionInput): Promise<Detection> {
    return http.crearDeteccion(input);
  },
};
