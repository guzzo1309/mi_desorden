import type { RolInfo } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/** Roles de un inventario con sus permisos (tabla roles, solo lectura). */
export const roles = {
  async listar(): Promise<RolInfo[]> {
    const { data, error } = await supabase.from("roles").select("*");
    siFalla(error);
    return data as RolInfo[];
  },
};

/** Id de la tabla roles para un nombre de rol. */
export async function idRol(rol: string): Promise<string> {
  const { data, error } = await supabase.from("roles").select("id").eq("rol", rol).single();
  siFalla(error);
  return data!.id as string;
}
