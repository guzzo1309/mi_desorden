import type { LimitesInventario, MiPlan, PedidoPlan, Periodo, Plan } from "@mi-desorden/core";

const aNumero = (n: number | null | undefined) => (n === null || n === undefined ? n : Number(n));
import { siFalla } from "./errores";
import { supabase } from "./supabase";

export const planes = {
  /** Mi plan y cuántos inventarios llevo creados. */
  async mio(): Promise<MiPlan> {
    const { data, error } = await supabase.rpc("mi_plan");
    siFalla(error);
    const p = data as MiPlan;
    return {
      ...p,
      max_categorias: p.max_categorias ?? null,
      precio_anual: aNumero(p.precio_anual),
      precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
    };
  },

  /** Límites del inventario y cuánto lleva usado. */
  async deInventario(inventarioId: string): Promise<LimitesInventario> {
    const { data, error } = await supabase.rpc("limites_inventario", { inv: inventarioId });
    siFalla(error);
    return data as LimitesInventario;
  },

  /** Los planes que se pueden elegir (activos), del más chico al más grande. */
  async disponibles(): Promise<Plan[]> {
    const consulta = (extra: string) =>
      supabase
        .from("planes")
        .select(
          `id, codigo, nombre, descripcion, max_inventarios, max_productos, max_personas${extra}, precio_mensual, activo, orden`,
        )
        .eq("activo", true)
        .order("orden");
    let { data, error } = await consulta(", max_categorias, precio_anual");
    // Sin las migraciones limite_categorias o compras_plan faltan columnas: sin
    // esos datos, pero anda.
    if (error && /precio_anual/.test(error.message)) {
      ({ data, error } = await consulta(", max_categorias"));
    }
    if (error && /max_categorias/.test(error.message)) ({ data, error } = await consulta(""));
    siFalla(error);
    return (data as unknown as Plan[]).map((p) => ({
      ...p,
      max_categorias: p.max_categorias ?? null,
      precio_anual: aNumero(p.precio_anual),
      precio_mensual: p.precio_mensual === null ? null : Number(p.precio_mensual),
    }));
  },

  /**
   * Compra el plan (de prueba: no se cobra nada). El plan cambia al instante y la
   * compra queda registrada para el admin.
   */
  async comprar(planId: string, periodo: Periodo) {
    const { data, error } = await supabase.rpc("comprar_plan", {
      p_plan: planId,
      p_periodo: periodo,
    });
    siFalla(error);
    return data as {
      plan: string;
      periodo: Periodo | null;
      monto: number;
      vence_en: string | null;
    };
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
