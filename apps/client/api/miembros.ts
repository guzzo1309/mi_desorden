import type { Rol } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

export const miembros = {
  /** Da acceso a alguien que ya tiene cuenta. Solo el dueño (lo valida la base). */
  async invitar(inventarioId: string, email: string, rol: Exclude<Rol, "dueño">) {
    const { error } = await supabase.rpc("invitar_miembro", {
      inv: inventarioId,
      correo: email,
      nuevo_rol: rol,
    });
    siFalla(error);
  },

  async cambiarRol(inventarioId: string, usuarioId: string, rol: Rol) {
    const { error } = await supabase
      .from("miembros")
      .update({ rol })
      .match({ inventario_id: inventarioId, usuario_id: usuarioId });
    siFalla(error);
  },

  async quitar(inventarioId: string, usuarioId: string) {
    const { error } = await supabase
      .from("miembros")
      .delete()
      .match({ inventario_id: inventarioId, usuario_id: usuarioId });
    siFalla(error);
  },
};
