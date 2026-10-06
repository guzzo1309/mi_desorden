import type { Producto } from "@mi-desorden/core";
import { supabase } from "./supabase";

export interface EventosInventario {
  productoCreado: (p: Producto) => void;
  productoActualizado: (p: Producto) => void;
  /** Llega sin filtrar por inventario (limitación de Realtime): ignorar ids que no conozcas. */
  productoEliminado: (id: string) => void;
  miembrosCambiaron: () => void;
  /** Ids de usuario que tienen el inventario abierto ahora. */
  presentes: (ids: Set<string>) => void;
}

/** Escucha un inventario en tiempo real y anuncia mi presencia. Devuelve cómo cortar. */
export function escucharInventario(inventarioId: string, usuarioId: string, on: EventosInventario) {
  const filtro = `inventario_id=eq.${inventarioId}`;
  const canal = supabase
    .channel(`inventario:${inventarioId}`, { config: { presence: { key: usuarioId } } })
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "productos", filter: filtro },
      (p) => on.productoCreado(p.new as Producto),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "productos", filter: filtro },
      (p) => on.productoActualizado(p.new as Producto),
    )
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "productos" }, (p) => {
      const id = (p.old as { id?: string }).id;
      if (id) on.productoEliminado(id);
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "miembros" }, () =>
      on.miembrosCambiaron(),
    )
    .on("presence", { event: "sync" }, () =>
      on.presentes(new Set(Object.keys(canal.presenceState()))),
    )
    .subscribe((estado) => {
      if (estado === "SUBSCRIBED") canal.track({ desde: new Date().toISOString() }).catch(() => {});
    });

  return () => {
    supabase.removeChannel(canal);
  };
}
