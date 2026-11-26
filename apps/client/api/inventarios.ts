import type { FuenteTitulo, Inventario, InvitacionPendiente, Rol } from "@mi-desorden/core";
import { normalizarColor, normalizarFuente } from "@/lib/personalizacion";
import { siFalla } from "./errores";
import { base64ABytes, BUCKET, CACHE_FOTO } from "./productos";
import { supabase } from "./supabase";

type Fila = {
  id: string;
  nombre: string;
  lugar: string;
  foto_path: string | null;
  fuente_titulo: string | null;
  color_titulo: string | null;
  creado_en: string;
  // rol_id → roles: PostgREST trae el nombre del rol con la clave foránea.
  miembros: {
    usuario_id: string;
    rol: { rol: Rol } | null;
    perfiles: { nombre: string; email: string } | null;
  }[];
  productos: { count: number }[];
  invitaciones: (Omit<InvitacionPendiente, "rol"> & {
    rol: { rol: InvitacionPendiente["rol"] } | null;
  })[];
};

const ORDEN_ROL: Record<Rol, number> = { owner: 0, editor: 1, lector: 2 };

export interface PersonalizacionInventarioInput {
  fuente_titulo?: FuenteTitulo | null;
  color_titulo?: string | null;
}

export const inventarios = {
  /** Los inventarios donde soy miembro (RLS), con su gente y cuántos productos tienen. */
  async listar(): Promise<Inventario[]> {
    const { data, error } = await supabase
      .from("inventarios")
      .select(
        "id, nombre, lugar, foto_path, fuente_titulo, color_titulo, creado_en, miembros(usuario_id, rol:roles(rol), perfiles(nombre, email)), productos(count), invitaciones(email, creado_en, rol:roles(rol))",
      )
      .order("creado_en");
    siFalla(error);

    return (data as unknown as Fila[]).map((inv) => ({
      id: inv.id,
      nombre: inv.nombre,
      lugar: inv.lugar,
      foto_path: inv.foto_path ?? null,
      fuente_titulo: normalizarFuente(inv.fuente_titulo),
      color_titulo: normalizarColor(inv.color_titulo),
      creado_en: inv.creado_en,
      total_productos: inv.productos[0]?.count ?? 0,
      // RLS: las invitaciones pendientes solo las ve quien gestiona accesos.
      pendientes: (inv.invitaciones ?? [])
        .map((i) => ({ email: i.email, creado_en: i.creado_en, rol: i.rol?.rol ?? "lector" }))
        .sort((a, b) => a.email.localeCompare(b.email)),
      miembros: inv.miembros
        .map((m) => ({
          usuario_id: m.usuario_id,
          rol: m.rol?.rol ?? "lector",
          nombre: m.perfiles?.nombre ?? "—",
          email: m.perfiles?.email ?? "",
          en_linea: false, // la presencia la pone realtime
        }))
        .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre)),
    }));
  },

  /** Crea el inventario; el trigger de la base me deja como owner. Devuelve el id. */
  async crear(
    nombre: string,
    lugar: string,
    personalizacion?: PersonalizacionInventarioInput,
  ): Promise<string> {
    const { data, error } = await supabase
      .from("inventarios")
      .insert({
        nombre: nombre.trim(),
        lugar: lugar.trim(),
        ...(personalizacion
          ? {
              fuente_titulo: normalizarFuente(personalizacion.fuente_titulo),
              color_titulo: normalizarColor(personalizacion.color_titulo),
            }
          : {}),
      })
      .select("id")
      .single();
    siFalla(error);
    return data!.id as string;
  },

  /**
   * Cambia el nombre, el lugar y la personalización visual. Solo el owner (lo valida RLS):
   * sin permiso no da error, simplemente no actualiza nada.
   */
  async actualizar(
    id: string,
    nombre: string,
    lugar: string,
    personalizacion?: PersonalizacionInventarioInput,
  ) {
    const campos: Record<string, string | null> = {
      nombre: nombre.trim(),
      lugar: lugar.trim(),
    };
    if (personalizacion) {
      if ("fuente_titulo" in personalizacion) {
        campos.fuente_titulo = normalizarFuente(personalizacion.fuente_titulo);
      }
      if ("color_titulo" in personalizacion) {
        campos.color_titulo = normalizarColor(personalizacion.color_titulo);
      }
    }
    const { data, error } = await supabase
      .from("inventarios")
      .update(campos)
      .eq("id", id)
      .select("id");
    siFalla(error);
    if (!data?.length) {
      throw new Error("No se guardó nada: puede que ya no exista o que no seas el owner.");
    }
  },

  /** Sube o reemplaza la imagen representativa del catálogo en `<id>/portada.jpg`. */
  async subirPortada(id: string, base64: string): Promise<string> {
    const ruta = `${id}/portada.jpg`;
    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, base64ABytes(base64), {
        contentType: "image/jpeg",
        upsert: true,
        cacheControl: CACHE_FOTO,
      });
    siFalla(errorSubida);
    const { data, error } = await supabase
      .from("inventarios")
      .update({ foto_path: ruta })
      .eq("id", id)
      .select("id");
    siFalla(error);
    if (!data?.length) {
      throw new Error("No se pudo guardar la imagen del catálogo.");
    }
    return ruta;
  },

  /** Quita la imagen representativa del catálogo. */
  async quitarPortada(id: string) {
    const { data, error } = await supabase
      .from("inventarios")
      .update({ foto_path: null })
      .eq("id", id)
      .select("id");
    siFalla(error);
    if (!data?.length) {
      throw new Error("No se pudo quitar la imagen del catálogo.");
    }
    await supabase.storage.from(BUCKET).remove([`${id}/portada.jpg`]);
  },

  /**
   * Borra el inventario con sus productos y miembros (cascade en la base).
   * Primero las fotos: después de borrar la fila ya no somos miembros y
   * Storage no nos dejaría tocarlas. Solo el owner (lo valida RLS).
   */
  async eliminar(id: string) {
    const { data: fotos } = await supabase.storage.from("productos").list(id, { limit: 1000 });
    if (fotos?.length)
      await supabase.storage.from("productos").remove(fotos.map((f) => `${id}/${f.name}`));

    const { data, error } = await supabase.from("inventarios").delete().eq("id", id).select("id");
    siFalla(error);
    // Con RLS, borrar sin permiso no da error: simplemente no borra nada.
    if (!data?.length) {
      throw new Error(
        "No se borró nada: puede que ya no exista o que no seas el owner. Tira hacia abajo para actualizar.",
      );
    }
  },
};
