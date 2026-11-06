import type { Categoria } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/** Categorías de un inventario (RLS: las ven los miembros, las cambia quien puede editar productos). */
export const categorias = {
  async listar(inventarioId: string): Promise<Categoria[]> {
    const { data, error } = await supabase
      .from("categorias")
      .select("*")
      .eq("inventario_id", inventarioId)
      .order("nombre");
    siFalla(error);
    return data as Categoria[];
  },

  async crear(inventarioId: string, nombre: string, padreId: string | null): Promise<Categoria> {
    const { data, error } = await supabase
      .from("categorias")
      .insert({ inventario_id: inventarioId, nombre: nombre.trim(), padre_id: padreId })
      .select()
      .single();
    siFalla(error);
    return data as Categoria;
  },

  async renombrar(id: string, nombre: string): Promise<Categoria> {
    const { data, error } = await supabase
      .from("categorias")
      .update({ nombre: nombre.trim() })
      .eq("id", id)
      .select()
      .single();
    siFalla(error);
    return data as Categoria;
  },

  async eliminar(id: string) {
    const { data, error } = await supabase.from("categorias").delete().eq("id", id).select("id");
    siFalla(error);
    if (!data?.length) throw new Error("No se pudo eliminar la categoría.");
  },
};
