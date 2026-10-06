import type { Inventario, Rol } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

type Fila = {
  id: string;
  nombre: string;
  lugar: string;
  creado_en: string;
  miembros: { usuario_id: string; rol: Rol; perfiles: { nombre: string; email: string } | null }[];
  productos: { count: number }[];
};

const ORDEN_ROL: Record<Rol, number> = { dueño: 0, editor: 1, lector: 2 };

export const inventarios = {
  /** Los inventarios donde soy miembro (RLS), con su gente y cuántos productos tienen. */
  async listar(): Promise<Inventario[]> {
    const { data, error } = await supabase
      .from("inventarios")
      .select(
        "id, nombre, lugar, creado_en, miembros(usuario_id, rol, perfiles(nombre, email)), productos(count)",
      )
      .order("creado_en");
    siFalla(error);

    return (data as unknown as Fila[]).map((inv) => ({
      id: inv.id,
      nombre: inv.nombre,
      lugar: inv.lugar,
      creado_en: inv.creado_en,
      total_productos: inv.productos[0]?.count ?? 0,
      miembros: inv.miembros
        .map((m) => ({
          usuario_id: m.usuario_id,
          rol: m.rol,
          nombre: m.perfiles?.nombre ?? "—",
          email: m.perfiles?.email ?? "",
          en_linea: false, // la presencia la pone realtime
        }))
        .sort((a, b) => ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] || a.nombre.localeCompare(b.nombre)),
    }));
  },

  /** Crea el inventario; el trigger de la base me deja como dueño. Devuelve el id. */
  async crear(nombre: string, lugar: string): Promise<string> {
    const { data, error } = await supabase
      .from("inventarios")
      .insert({ nombre: nombre.trim(), lugar: lugar.trim() })
      .select("id")
      .single();
    siFalla(error);
    return data!.id as string;
  },
};
