import type { RolInfo } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/** Catálogo de roles de un inventario (tabla roles, solo lectura). */
export const roles = {
  async listar(): Promise<RolInfo[]> {
    const { data, error } = await supabase.from("roles").select("*").order("orden");
    siFalla(error);
    return data as RolInfo[];
  },
};
