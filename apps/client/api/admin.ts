import type { AdminPlan, AdminResumen, AdminUsuario, PlanInput } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/**
 * Panel del admin de MI DESORDEN. Todo pasa por funciones de la base que exigen
 * es_admin(): quien no es admin recibe un error, no datos.
 */
export const admin = {
  /** ¿Mi cuenta es admin de la plataforma? Solo decide qué pantallas se muestran. */
  async esAdmin(): Promise<boolean> {
    const { data, error } = await supabase.rpc("es_admin");
    siFalla(error);
    return data === true;
  },

  async resumen(): Promise<AdminResumen> {
    const { data, error } = await supabase.rpc("admin_resumen");
    siFalla(error);
    return data as AdminResumen;
  },

  async usuarios(): Promise<AdminUsuario[]> {
    const { data, error } = await supabase.rpc("admin_usuarios");
    siFalla(error);
    return data as AdminUsuario[];
  },

  async planes(): Promise<AdminPlan[]> {
    const { data, error } = await supabase.rpc("admin_planes");
    siFalla(error);
    return (data as AdminPlan[]).map((p) => ({
      ...p,
      // numeric llega como texto desde PostgREST.
      precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
    }));
  },

  /** Crea (sin id) o actualiza un plan. El código no cambia al editar. */
  async guardarPlan(p: PlanInput): Promise<string> {
    const { data, error } = await supabase.rpc("admin_guardar_plan", {
      p_id: p.id ?? null,
      p_codigo: p.codigo,
      p_nombre: p.nombre,
      p_descripcion: p.descripcion,
      p_max_inventarios: p.max_inventarios,
      p_max_productos: p.max_productos,
      p_max_personas: p.max_personas,
      p_precio_mensual: p.precio_mensual,
      p_activo: p.activo,
      p_orden: p.orden ?? null,
    });
    siFalla(error);
    return data as string;
  },

  async asignarPlan(usuarioId: string, planId: string) {
    const { error } = await supabase.rpc("admin_asignar_plan", {
      p_usuario: usuarioId,
      p_plan: planId,
    });
    siFalla(error);
  },
};
