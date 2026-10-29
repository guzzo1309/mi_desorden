import type { LineaFactura, Producto, ProductoCargado, ProductoInput } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

const BUCKET = "productos";

/** base64 → bytes, para subir a Storage sin depender de Blob (poco confiable en React Native). */
function base64ABytes(base64: string): Uint8Array {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

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

  async eliminar(producto: Pick<Producto, "id" | "foto_path">) {
    const { error } = await supabase.from("productos").delete().eq("id", producto.id);
    siFalla(error);
    // La foto no se borra sola con la fila: se limpia acá (si falla, queda huérfana, no rompe nada).
    if (producto.foto_path) await supabase.storage.from(BUCKET).remove([producto.foto_path]);
  },

  /**
   * Sube la foto (JPEG en base64, como la devuelve expo-camera) y la asocia al
   * producto. Siempre la misma ruta por producto: reemplaza la anterior.
   */
  async subirFoto(
    producto: Pick<Producto, "id" | "inventario_id">,
    base64: string,
  ): Promise<Producto> {
    const ruta = `${producto.inventario_id}/${producto.id}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, base64ABytes(base64), { contentType: "image/jpeg", upsert: true });
    siFalla(errorSubida);
    const { data, error } = await supabase
      .from("productos")
      .update({ foto_path: ruta })
      .eq("id", producto.id)
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },

  async quitarFoto(producto: Pick<Producto, "id" | "foto_path">): Promise<Producto> {
    if (producto.foto_path) await supabase.storage.from(BUCKET).remove([producto.foto_path]);
    const { data, error } = await supabase
      .from("productos")
      .update({ foto_path: null })
      .eq("id", producto.id)
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },

  /** URL firmada (el bucket es privado). Dura una hora; React Query la renueva antes. */
  async urlFoto(ruta: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, 3600);
    siFalla(error);
    return data!.signedUrl;
  },

  /**
   * Carga varios productos de una vez (factura o Excel), todo o nada: a los que
   * ya existen les suma la cantidad y los que no, los crea sin categoría.
   */
  async cargarLote(inventarioId: string, lineas: LineaFactura[]): Promise<ProductoCargado[]> {
    const { data, error } = await supabase.rpc("cargar_productos", {
      inv: inventarioId,
      lineas,
    });
    siFalla(error);
    return data as ProductoCargado[];
  },

  /** La cámara reconoció el producto: nueva cantidad y queda marcado como visto por la cámara. */
  async ajustarDesdeCamara(id: string, cantidad: number): Promise<Producto> {
    return productos.ajustarStock(id, cantidad, "camara");
  },

  /**
   * Solo la cantidad: es lo único que puede cambiar un rol con ajustar_stock
   * y sin editar_productos (el trigger proteger_producto frena el resto).
   */
  async ajustarStock(
    id: string,
    cantidad: number,
    fuente: Producto["fuente"] = "manual",
  ): Promise<Producto> {
    const { data, error } = await supabase
      .from("productos")
      .update({ cantidad: Math.max(0, Math.round(cantidad)), fuente })
      .eq("id", id)
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },
};
