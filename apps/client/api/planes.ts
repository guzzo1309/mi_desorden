import type { LimitesInventario, MiPlan, PedidoPlan, Plan } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

export const planes = {
  /** Mi plan y cuántos inventarios llevo creados. */
  async mio(): Promise<MiPlan> {
    const { data, error } = await supabase.rpc("mi_plan");
    siFalla(error);
    const p = data as MiPlan;
    return { ...p, precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual) };
  },

  /** Límites del inventario y cuánto lleva usado. */
  async deInventario(inventarioId: string): Promise<LimitesInventario> {
    const { data, error } = await supabase.rpc("limites_inventario", { inv: inventarioId });
    siFalla(error);
    return data as LimitesInventario;
  },

  /** Los planes que se pueden elegir (activos), del más chico al más grande. */
  async disponibles(): Promise<Plan[]> {
    const { data, error } = await supabase
      .from("planes")
      .select(
        "id, codigo, nombre, descripcion, max_inventarios, max_productos, max_personas, precio_mensual, activo, orden",
      )
      .eq("activo", true)
      .order("orden");
    siFalla(error);
    return (data as Plan[]).map((p) => ({
      ...p,
      precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
    }));
  },

  /** Pide otro plan al admin. Si ya había un pedido pendiente, lo reemplaza. */
  async pedir(planId: string, motivo: string) {
    const { error } = await supabase.rpc("pedir_plan", { p_plan: planId, p_motivo: motivo });
    siFalla(error);
  },

  /** Mi pedido pendiente, o null. */
  async miPedido(): Promise<PedidoPlan | null> {
    const { data, error } = await supabase.rpc("mi_pedido_plan");
    siFalla(error);
    return (data as PedidoPlan | null) ?? null;
  },

  async cancelarPedido() {
    const { error } = await supabase.rpc("cancelar_pedido_plan");
    siFalla(error);
  },
};
