import type { Perfil } from "@mi-desorden/core";
import { limpiarNombre, limpiarTelefono } from "@/lib/perfil";
import { siFalla } from "./errores";
import { base64ABytes } from "./productos";
import { supabase } from "./supabase";

const BUCKET = "avatares";
/** Vigencia de la URL firmada: mientras dura la misma URL, iOS reusa la foto que ya bajó. */
const URL_VIGENCIA = 24 * 60 * 60;
const COLUMNAS = "id, nombre, email, telefono, avatar_path";

async function miId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Tu sesión venció. Vuelve a iniciar sesión.");
  return id;
}

/** El perfil propio: nombre, teléfono y foto. */
export const perfil = {
  async mio(): Promise<Perfil> {
    const id = await miId();
    const { data, error } = await supabase.from("perfiles").select(COLUMNAS).eq("id", id).single();
    siFalla(error);
    return data as Perfil;
  },

  /**
   * Guarda nombre y teléfono. El nombre va también a los metadatos de la cuenta: de
   * ahí lo lee la sesión, que se actualiza sola (USER_UPDATED) en toda la app.
   */
  async guardar(cambios: { nombre: string; telefono: string }): Promise<Perfil> {
    const id = await miId();
    const nombre = limpiarNombre(cambios.nombre);
    const { data, error } = await supabase
      .from("perfiles")
      .update({ nombre, telefono: limpiarTelefono(cambios.telefono) })
      .eq("id", id)
      .select(COLUMNAS)
      .single();
    siFalla(error);
    const { error: errorCuenta } = await supabase.auth.updateUser({ data: { nombre } });
    siFalla(errorCuenta);
    return data as Perfil;
  },

  /**
   * Sube la foto nueva (JPEG en base64) y borra la anterior. Va en una ruta nueva cada
   * vez: con la misma, el teléfono seguiría mostrando la vieja que tiene guardada.
   */
  async cambiarFoto(base64: string): Promise<Perfil> {
    const id = await miId();
    const anterior = (await perfil.mio()).avatar_path;
    const ruta = `${id}/${Date.now().toString(36)}.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, base64ABytes(base64), { contentType: "image/jpeg", cacheControl: "86400" });
    siFalla(errorSubida);
    const { data, error } = await supabase
      .from("perfiles")
      .update({ avatar_path: ruta })
      .eq("id", id)
      .select(COLUMNAS)
      .single();
    if (error) {
      // No quedó asociada: no se deja el archivo suelto.
      await supabase.storage.from(BUCKET).remove([ruta]);
      siFalla(error);
    }
    if (anterior) await supabase.storage.from(BUCKET).remove([anterior]);
    return data as Perfil;
  },

  async quitarFoto(): Promise<Perfil> {
    const id = await miId();
    const anterior = (await perfil.mio()).avatar_path;
    const { data, error } = await supabase
      .from("perfiles")
      .update({ avatar_path: null })
      .eq("id", id)
      .select(COLUMNAS)
      .single();
    siFalla(error);
    if (anterior) await supabase.storage.from(BUCKET).remove([anterior]);
    return data as Perfil;
  },

  /** URL firmada (el bucket es privado). */
  async urlFoto(ruta: string): Promise<string> {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(ruta, URL_VIGENCIA);
    siFalla(error);
    return data!.signedUrl;
  },
};
