import type { Rol } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { http } from "./http";
import { idRol } from "./roles";
import { supabase } from "./supabase";

export const miembros = {
  /**
   * Da acceso. Si el correo tiene cuenta queda como miembro; si no, queda una
   * invitación pendiente que se acepta sola cuando confirme el correo. Solo
   * quien gestiona accesos, y solo roles que puede dar (lo valida la base).
   */
  async invitar(
    inventarioId: string,
    email: string,
    rol: Exclude<Rol, "owner">,
  ): Promise<"miembro" | "pendiente"> {
    const { data, error } = await supabase.rpc("invitar", {
      inv: inventarioId,
      correo: email,
      nuevo_rol: rol,
    });
    siFalla(error);
    return data as "miembro" | "pendiente";
  },

  /** Correo con el enlace a la app (lo manda la API, que verifica la invitación). */
  async avisar(email: string, inventarioIds: string[]) {
    return http.avisarInvitacion(email, inventarioIds);
  },

  async cancelarInvitacion(inventarioId: string, email: string) {
    const { error } = await supabase
      .from("invitaciones")
      .delete()
      .match({ inventario_id: inventarioId, email });
    siFalla(error);
  },

  async cambiarRol(inventarioId: string, usuarioId: string, rol: Exclude<Rol, "owner">) {
    const { error } = await supabase
      .from("miembros")
      .update({ rol_id: await idRol(rol) })
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
