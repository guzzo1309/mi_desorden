import type { Solicitud, SolicitudInput } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/**
 * Pedidos de un lector (agregar, eliminar o cambiar stock). RLS: cada uno ve
 * los suyos; owner y editores ven y resuelven todos los del inventario.
 */
export const solicitudes = {
  async pendientes(inventarioId: string): Promise<Solicitud[]> {
    const { data, error } = await supabase
      .from("solicitudes")
      .select("*")
      .eq("inventario_id", inventarioId)
      .eq("estado", "pendiente")
      .order("creado_en");
    siFalla(error);
    return data as Solicitud[];
  },

  async crear(inventarioId: string, input: SolicitudInput): Promise<Solicitud> {
    const { data, error } = await supabase
      .from("solicitudes")
      .insert({ ...input, inventario_id: inventarioId, detalle: input.detalle?.trim() ?? "" })
      .select()
      .single();
    siFalla(error);
    return data as Solicitud;
  },

  async resolver(id: string, estado: "aceptada" | "rechazada"): Promise<void> {
    const { data, error } = await supabase
      .from("solicitudes")
      .update({ estado })
      .eq("id", id)
      .select("id");
    siFalla(error);
    if (!data?.length) throw new Error("No se pudo resolver: puede que ya la haya resuelto otro.");
  },

  /** Quien la hizo la retira mientras sigue pendiente. */
  async retirar(id: string): Promise<void> {
    const { error } = await supabase.from("solicitudes").delete().eq("id", id);
    siFalla(error);
  },
};
