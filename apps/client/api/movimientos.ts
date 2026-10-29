import type { Movimiento } from "@mi-desorden/core";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

/** Cuántos renglones se piden por vez. */
export const PAGINA_MOVIMIENTOS = 50;

export const movimientos = {
  /**
   * Historial del inventario, del más nuevo al más viejo. `antes` es el id del
   * último renglón que ya se tiene: devuelve los que siguen. Solo el owner (RLS).
   */
  async listar(inventarioId: string, antes?: number): Promise<Movimiento[]> {
    let q = supabase
      .from("movimientos")
      .select(
        "id, producto_id, producto_nombre, usuario_id, tipo, cantidad_antes, cantidad_despues, fuente, detalle, creado_en, usuario:perfiles(nombre)",
      )
      .eq("inventario_id", inventarioId)
      .order("id", { ascending: false })
      .limit(PAGINA_MOVIMIENTOS);
    if (antes !== undefined) q = q.lt("id", antes);
    const { data, error } = await q;
    siFalla(error);
    return data as unknown as Movimiento[];
  },
};
