import type { CrearEmpleadoInput, ResultadoEmpleado, Rol } from "@mi-desorden/core";
import { mensajeError, siFalla } from "./errores";
import { http } from "./http";
import { idRol } from "./roles";
import { supabase } from "./supabase";

export const miembros = {
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

  /**
   * Crea la cuenta del empleado con una contraseña temporal y lo agrega a los
   * inventarios (lo hace la API con la service key; la base valida rol y límites).
   * Si el correo ya tenía cuenta, solo se lo agrega: su contraseña no se toca.
   */
  async agregarEmpleado(input: CrearEmpleadoInput): Promise<ResultadoEmpleado> {
    try {
      return await http.crearEmpleado(input);
    } catch (e) {
      throw new Error(mensajeError(e));
    }
  },
};
