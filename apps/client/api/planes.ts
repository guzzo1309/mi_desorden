import type { LimitesInventario, MiPlan } from "@mi-desorden/core";
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
};
