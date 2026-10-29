import type { Inventario, InvitacionPendiente, Rol } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

type Fila = {
  id: string;
  nombre: string;
  lugar: string;
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

export const inventarios = {
  /** Los inventarios donde soy miembro (RLS), con su gente y cuántos productos tienen. */
  async listar(): Promise<Inventario[]> {
    const { data, error } = await supabase
      .from("inventarios")
      .select(
        "id, nombre, lugar, creado_en, miembros(usuario_id, rol:roles(rol), perfiles(nombre, email)), productos(count), invitaciones(email, creado_en, rol:roles(rol))",
      )
      .order("creado_en");
    siFalla(error);

    return (data as unknown as Fila[]).map((inv) => ({
      id: inv.id,
      nombre: inv.nombre,
      lugar: inv.lugar,
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
  async crear(nombre: string, lugar: string): Promise<string> {
    const { data, error } = await supabase
      .from("inventarios")
      .insert({ nombre: nombre.trim(), lugar: lugar.trim() })
      .select("id")
      .single();
    siFalla(error);
    return data!.id as string;
  },

  /**
   * Cambia el nombre y el lugar. Solo el owner (lo valida RLS): sin permiso no da
   * error, simplemente no actualiza nada.
   */
  async actualizar(id: string, nombre: string, lugar: string) {
    const { data, error } = await supabase
      .from("inventarios")
      .update({ nombre: nombre.trim(), lugar: lugar.trim() })
      .eq("id", id)
      .select("id");
    siFalla(error);
    if (!data?.length) {
      throw new Error("No se guardó nada: puede que ya no exista o que no seas el owner.");
    }
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
