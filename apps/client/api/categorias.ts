import type { Categoria, ColorCategoria, FuenteCategoria } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { base64ABytes } from "./productos";
import { supabase } from "./supabase";

const BUCKET = "categorias";
/** Vigencia de la URL firmada: mientras dura la misma URL, iOS reusa la imagen que ya bajó. */
const URL_VIGENCIA = 24 * 60 * 60;

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

  /** Ícono, letra y color del título (solo el owner: lo valida la base). */
  async personalizar(
    id: string,
    estilo: {
      fuente: FuenteCategoria | null;
      color: ColorCategoria | null;
      icono: string | null;
    },
  ): Promise<Categoria> {
    const { data, error } = await supabase
      .from("categorias")
      .update(estilo)
      .eq("id", id)
      .select()
      .single();
    siFalla(error);
    return data as Categoria;
  },

  /**
   * Sube la imagen nueva (JPEG en base64) y borra la anterior. Va en una ruta nueva cada
   * vez: con la misma, el teléfono seguiría mostrando la vieja que tiene guardada.
   */
  async cambiarImagen(
    categoria: Pick<Categoria, "id" | "inventario_id" | "imagen_path">,
    base64: string,
  ): Promise<Categoria> {
    const ruta = `${categoria.inventario_id}/${categoria.id}-${Date.now().toString(36)}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, base64ABytes(base64), { contentType: "image/jpeg", cacheControl: "86400" });
    siFalla(errorSubida);
    const { data, error } = await supabase
      .from("categorias")
      .update({ imagen_path: ruta })
      .eq("id", categoria.id)
      .select()
      .single();
    if (error) {
      // No quedó asociada: no se deja el archivo suelto.
      await supabase.storage.from(BUCKET).remove([ruta]);
      siFalla(error);
    }
    if (categoria.imagen_path) await supabase.storage.from(BUCKET).remove([categoria.imagen_path]);
    return data as Categoria;
  },

  async quitarImagen(categoria: Pick<Categoria, "id" | "imagen_path">): Promise<Categoria> {
    const { data, error } = await supabase
      .from("categorias")
      .update({ imagen_path: null })
      .eq("id", categoria.id)
      .select()
      .single();
    siFalla(error);
    if (categoria.imagen_path) await supabase.storage.from(BUCKET).remove([categoria.imagen_path]);
    return data as Categoria;
  },

  /** URL firmada (el bucket es privado). */
  async urlImagen(ruta: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, URL_VIGENCIA);
    siFalla(error);
    return data!.signedUrl;
  },
};
