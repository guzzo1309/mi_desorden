import type { Inventario, InvitacionPendiente, Moneda, Rol } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

type Fila = {
  id: string;
  nombre: string;
  lugar: string;
  moneda?: Moneda;
  creado_en: string;
  // rol_id → roles: PostgREST trae el nombre del rol con la clave foránea.
  miembros: {
    usuario_id: string;
    rol: { rol: Rol } | null;
    perfiles: { nombre: string; email: string; avatar_path?: string | null } | null;
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
    let perfil = "nombre, email, avatar_path";
    let moneda = ", moneda";
    const consulta = () =>
      supabase
        .from("inventarios")
        .select(
          `id, nombre, lugar${moneda}, creado_en, miembros(usuario_id, rol:roles(rol), perfiles(${perfil})), productos(count), invitaciones(email, creado_en, rol:roles(rol))`,
        )
        .order("creado_en");
    let { data, error } = await consulta();
    // Sin las migraciones perfil_personalizable o inventario_moneda faltan esas
    // columnas: sin fotos o en dólares, pero anda.
    for (let i = 0; i < 2 && error; i++) {
      if (/avatar_path/.test(error.message)) perfil = "nombre, email";
      else if (/moneda/.test(error.message)) moneda = "";
      else break;
      ({ data, error } = await consulta());
    }
    siFalla(error);

    return (data as unknown as Fila[]).map((inv) => ({
      id: inv.id,
      nombre: inv.nombre,
      lugar: inv.lugar,
      moneda: inv.moneda === "EUR" ? "EUR" : "USD",
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
          avatar_path: m.perfiles?.avatar_path ?? null,
          en_linea: false, // la presencia la pone realtime
        }))
        .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre)),
    }));
  },

  /** Crea el inventario; el trigger de la base me deja como owner. Devuelve el id. */
  async crear(nombre: string, lugar: string, moneda: Moneda = "USD"): Promise<string> {
    const { data, error } = await supabase
      .from("inventarios")
      // USD es el default de la base: así crear anda aunque falte la migración.
      .insert({
        nombre: nombre.trim(),
        lugar: lugar.trim(),
        ...(moneda !== "USD" ? { moneda } : {}),
      })
      .select("id")
      .single();
    siFalla(error);
    return data!.id as string;
  },

  /**
   * Cambia el nombre, el lugar y, si viene, la moneda. Solo el owner (lo valida
   * RLS): sin permiso no da error, simplemente no actualiza nada.
   */
  async actualizar(id: string, nombre: string, lugar: string, moneda?: Moneda) {
    const { data, error } = await supabase
      .from("inventarios")
      .update({ nombre: nombre.trim(), lugar: lugar.trim(), ...(moneda ? { moneda } : {}) })
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
