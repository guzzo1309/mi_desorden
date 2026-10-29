import type { LineaFactura, Producto, ProductoCargado, ProductoInput } from "@mi-desorden/core";
import { MAX_FOTOS, rutasDe, rutasPesadas, sinFoto } from "@/lib/fotos";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

const BUCKET = "productos";
/** Vigencia de las URLs firmadas: mientras dura la misma URL, iOS reusa la foto que ya bajó. */
const URL_VIGENCIA = 24 * 60 * 60;
/** Cuánto puede guardar la foto el teléfono (segundos). */
const CACHE_FOTO = "86400";

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

  async eliminar(producto: Pick<Producto, "id" | "foto_path" | "fotos_extra">) {
    const { error } = await supabase.from("productos").delete().eq("id", producto.id);
    siFalla(error);
    // Las fotos no se borran solas con la fila: se limpian acá (si falla, quedan huérfanas, no rompe nada).
    const rutas = rutasDe(producto);
    if (rutas.length) await supabase.storage.from(BUCKET).remove(rutas);
  },

  /**
   * Sube la foto principal (JPEG en base64, como la devuelve expo-camera) y la
   * asocia al producto. Si ya tenía una, la reemplaza en la misma ruta.
   */
  async subirFoto(
    producto: Pick<Producto, "id" | "inventario_id" | "foto_path">,
    base64: string,
  ): Promise<Producto> {
    const ruta = producto.foto_path ?? `${producto.inventario_id}/${producto.id}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, base64ABytes(base64), {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: CACHE_FOTO,
      });
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

  /**
   * Suma otra foto (hasta MAX_FOTOS en total, la principal incluida). Cada una va
   * en su propia ruta: el modelo compara contra todas y se queda con la más parecida.
   */
  async agregarFotoExtra(
    producto: Pick<Producto, "id" | "inventario_id" | "foto_path" | "fotos_extra">,
    base64: string,
  ): Promise<Producto> {
    if (!producto.foto_path) return productos.subirFoto(producto, base64);
    if (rutasDe(producto).length >= MAX_FOTOS) {
      throw new Error(
        `Un producto tiene como máximo ${MAX_FOTOS} fotos. Quita una para sumar otra.`,
      );
    }
    const sufijo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const ruta = `${producto.inventario_id}/${producto.id}-${sufijo}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, base64ABytes(base64), { contentType: "image/jpeg", cacheControl: CACHE_FOTO });
    siFalla(errorSubida);
    const { data, error } = await supabase
      .from("productos")
      .update({ fotos_extra: [...(producto.fotos_extra ?? []), ruta] })
      .eq("id", producto.id)
      .select()
      .single();
    if (error) {
      // No quedó asociada: no se deja el archivo suelto.
      await supabase.storage.from(BUCKET).remove([ruta]);
      siFalla(error);
    }
    return data as Producto;
  },

  /**
   * Quita una de las fotos (principal o extra). Si era la principal, la primera
   * extra pasa a serlo.
   */
  async quitarFotoDe(
    producto: Pick<Producto, "id" | "foto_path" | "fotos_extra">,
    ruta: string,
  ): Promise<Producto> {
    await supabase.storage.from(BUCKET).remove([ruta]);
    const { data, error } = await supabase
      .from("productos")
      .update(sinFoto(producto, ruta))
      .eq("id", producto.id)
      .select()
      .single();
    siFalla(error);
    return data as Producto;
  },

  /** URL firmada (el bucket es privado). Dura una hora; React Query la renueva antes. */
  async urlFoto(ruta: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, URL_VIGENCIA);
    siFalla(error);
    return data!.signedUrl;
  },

  /** Las fotos del inventario que pesan demasiado para una miniatura (las subidas antes de achicarlas). */
  async fotosPesadas(inventarioId: string): Promise<string[]> {
    const { data, error } = await supabase.storage.from(BUCKET).list(inventarioId, { limit: 1000 });
    siFalla(error);
    return rutasPesadas(data ?? [], inventarioId);
  },

  /** Cambia el contenido de una foto, en la misma ruta (el producto sigue apuntando a ella). */
  async reemplazarFoto(ruta: string, base64: string) {
    const { error } = await supabase.storage.from(BUCKET).upload(ruta, base64ABytes(base64), {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: CACHE_FOTO,
    });
    siFalla(error);
  },

  /** Las URLs de muchas fotos en un solo pedido (en vez de uno por foto): ruta → URL. */
  async urlsFotos(rutas: string[]): Promise<Record<string, string>> {
    if (!rutas.length) return {};
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrls(rutas, URL_VIGENCIA);
    siFalla(error);
    const salida: Record<string, string> = {};
    for (const d of data ?? []) if (d.path && d.signedUrl) salida[d.path] = d.signedUrl;
    return salida;
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
