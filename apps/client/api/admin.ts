import type {
  AdminPedidoPlan,
  AdminPedidoResuelto,
  AdminPlan,
  AdminResumen,
  AdminUsuario,
  AdminUsuarioDetalle,
  PlanInput,
} from "@mi-desorden/core";
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

  async usuarioDetalle(id: string): Promise<AdminUsuarioDetalle> {
    const { data, error } = await supabase.rpc("admin_usuario_detalle", { p_usuario: id });
    siFalla(error);
    return data as AdminUsuarioDetalle;
  },

  /** Suspende (no puede iniciar sesión y se le cierran las sesiones) o reactiva una cuenta. */
  async suspender(usuarioId: string, suspender: boolean, motivo?: string) {
    const { error } = await supabase.rpc("admin_suspender", {
      p_usuario: usuarioId,
      p_suspender: suspender,
      p_motivo: motivo?.trim() || null,
    });
    siFalla(error);
  },

  /** Pedidos de cambio de plan que esperan respuesta, del más viejo al más nuevo. */
  async pedidos(): Promise<AdminPedidoPlan[]> {
    const { data, error } = await supabase.rpc("admin_pedidos_plan");
    siFalla(error);
    return data as AdminPedidoPlan[];
  },

  /** Aprueba (cambia el plan de la cuenta) o rechaza un pedido. */
  async resolverPedido(id: string, aprobar: boolean) {
    const { error } = await supabase.rpc("admin_resolver_pedido", {
      p_id: id,
      p_aprobar: aprobar,
    });
    siFalla(error);
  },

  /** Los últimos pedidos de plan ya resueltos (aprobados, rechazados o cancelados). */
  async pedidosResueltos(limite = 20): Promise<AdminPedidoResuelto[]> {
    const { data, error } = await supabase.rpc("admin_pedidos_resueltos", { p_limite: limite });
    siFalla(error);
    return data as AdminPedidoResuelto[];
  },
};
