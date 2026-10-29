import type { Producto, Solicitud } from "@mi-desorden/core";
import { supabase } from "./supabase";

export interface EventosInventario {
  productoCreado: (p: Producto) => void;
  productoActualizado: (p: Producto) => void;
  /** Llega sin filtrar por inventario (limitación de Realtime): ignorar ids que no conozcas. */
  productoEliminado: (id: string) => void;
  miembrosCambiaron: () => void;
  categoriasCambiaron: () => void;
  /** Llegó una solicitud nueva (solo la reciben quienes pueden verla, por RLS). */
  solicitudCreada: (s: Solicitud) => void;
  /** Se resolvió o se retiró una solicitud. */
  solicitudesCambiaron: () => void;
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
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "invitaciones", filter: filtro },
      () => on.miembrosCambiaron(),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "categorias", filter: filtro },
      () => on.categoriasCambiaron(),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "solicitudes", filter: filtro },
      (p) => on.solicitudCreada(p.new as Solicitud),
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "solicitudes", filter: filtro },
      () => on.solicitudesCambiaron(),
    )
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "solicitudes" }, () =>
      on.solicitudesCambiaron(),
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

/**
 * Avisa cuando me dan acceso a un inventario (o me lo sacan), aunque no tenga
 * ninguno abierto: así lo nuevo aparece sin tener que actualizar.
 */
export function escucharMisAccesos(usuarioId: string, alCambiar: () => void) {
  const canal = supabase
    .channel(`accesos:${usuarioId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "miembros", filter: `usuario_id=eq.${usuarioId}` },
      () => alCambiar(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
