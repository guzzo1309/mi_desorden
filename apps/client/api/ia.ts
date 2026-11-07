import {
  ApiError,
  type DescripcionIa,
  type DescripcionIaInput,
  type UsoIa,
} from "@mi-desorden/core";
import { mensajeError, siFalla } from "./errores";
import { http } from "./http";
import { supabase } from "./supabase";

/** IA para la descripción de productos (la llama la API de Nest; la cuota vive en Supabase). */
export const ia = {
  /** La IA escribe (modo "generar") o mejora (modo "mejorar") la descripción. Solo el owner. */
  async descripcion(input: DescripcionIaInput): Promise<DescripcionIa> {
    try {
      return await http.descripcionIa(input);
    } catch (e) {
      // Límite del mes, IA ocupada o no configurada: la API ya manda el texto para mostrar.
      // (Un 429 del límite general de requests trae otro texto: ese queda en "Demasiados intentos").
      if (
        e instanceof ApiError &&
        e.detalle &&
        ([502, 503].includes(e.status) || (e.status === 429 && /límite/i.test(e.detalle)))
      ) {
        throw new Error(e.detalle);
      }
      throw new Error(mensajeError(e));
    }
  },

  /** Cuántos tokens de IA me quedan este mes. */
  async miUso(): Promise<UsoIa> {
    const { data, error } = await supabase.rpc("mi_uso_ia");
    siFalla(error);
    return data as UsoIa;
  },
};
