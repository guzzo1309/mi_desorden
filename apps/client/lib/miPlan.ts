import { useQuery } from "@tanstack/react-query";
import { planes as planesApi } from "@/api";
import { useSesion } from "@/lib/store";

/**
 * Mi plan y cuánto llevo usado. Se vuelve a pedir al crear o borrar inventarios.
 * Con `fresco`, además cada vez que se abre la pantalla (para decidir si se puede crear).
 */
export function useMiPlan({ fresco = false }: { fresco?: boolean } = {}) {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: ["miPlan", usuario?.id],
    enabled: !!usuario,
    refetchOnMount: fresco ? "always" : true,
    queryFn: planesApi.mio,
  });
}

/** Límites del inventario activo y cuánto lleva usado. Se actualiza al cambiar productos o gente. */
export function useLimitesInventario(
  inventarioId: string | undefined,
  { fresco = false }: { fresco?: boolean } = {},
) {
  return useQuery({
    queryKey: ["limites", inventarioId],
    enabled: !!inventarioId,
    refetchOnMount: fresco ? "always" : true,
    queryFn: () => planesApi.deInventario(inventarioId!),
  });
}

/** Mi pedido de cambio de plan pendiente (o null). */
export function useMiPedido() {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: ["miPedido", usuario?.id],
    enabled: !!usuario,
    queryFn: planesApi.miPedido,
  });
}
