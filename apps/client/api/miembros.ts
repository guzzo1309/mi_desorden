import type { CrearEmpleadoInput, ResultadoEmpleado, Rol } from "@mi-desorden/core";
import { mensajeError, servidorNoDisponible, siFalla } from "./errores";
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
      // Sin servidor (sin red hasta la API o la API caída): se invita por correo
      // directo en la base. Los errores del usuario (permiso, límite) sí se muestran.
      if (!servidorNoDisponible(e)) throw new Error(mensajeError(e));
      return await invitarSinServidor(input);
    }
  },
};

/**
 * Plan B sin la API: invitar(inv, correo, rol) en la base. Si el correo ya tiene
 * cuenta, entra directo; si no, queda una invitación que se acepta sola al
 * registrarse con ese correo (la contraseña la elige la persona).
 */
async function invitarSinServidor(input: CrearEmpleadoInput): Promise<ResultadoEmpleado> {
  const agregados: string[] = [];
  const errores: ResultadoEmpleado["errores"] = [];
  let pendiente = false;
  for (const inv of input.inventarios) {
    const { data, error } = await supabase.rpc("invitar", {
      inv,
      correo: input.email,
      nuevo_rol: input.rol,
    });
    if (error) errores.push({ inventario: inv, mensaje: mensajeError(error) });
    else {
      agregados.push(inv);
      if (data === "pendiente") pendiente = true;
    }
  }
  return { creada: false, agregados, errores, invitado: pendiente };
}
