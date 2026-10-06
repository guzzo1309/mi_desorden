import type { Producto, ProductoInput } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

export const productos = {
  async listar(inventarioId: string): Promise<Producto[]> {
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .eq("inventario_id", inventarioId);
    siFalla(error);
    return data as Producto[];
  },

  async crear(inventarioId: string, input: ProductoInput): Promise<Producto> {
    const { data, error } = await supabase
      .from("productos")
      .insert({ ...input, inventario_id: inventarioId, fuente: "manual" })
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },

  async actualizar(id: string, input: ProductoInput): Promise<Producto> {
    const { data, error } = await supabase
      .from("productos")
      .update({ ...input, fuente: "manual" })
      .eq("id", id)
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },

  async eliminar(id: string) {
    const { error } = await supabase.from("productos").delete().eq("id", id);
    siFalla(error);
  },

  /** La cámara reconoció el producto: queda marcado como visto por la cámara. */
  async marcarDetectado(id: string): Promise<Producto> {
    const { data, error } = await supabase
      .from("productos")
      .update({ fuente: "camara" })
      .eq("id", id)
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },
};
