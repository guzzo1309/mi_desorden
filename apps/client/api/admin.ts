import type { AdminResumen, AdminUsuario } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/**
 * Panel del admin de MI DESORDEN. Todo pasa por funciones de la base que exigen
 * es_admin(): quien no es admin recibe un error, no datos.
 */
export const admin = {
  /** ¿Mi cuenta es admin de la plataforma? Solo decide qué pantallas se muestran. */
  async esAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc("es_admin");
    siFalla(error);
    return data === true;
  },

  async resumen(): Promise<AdminResumen> {
    const { data, error } = await supabase.rpc("admin_resumen");
    siFalla(error);
    return data as AdminResumen;
  },

  async usuarios(): Promise<AdminUsuario[]> {
    const { data, error } = await supabase.rpc("admin_usuarios");
    siFalla(error);
    return data as AdminUsuario[];
  },
};
