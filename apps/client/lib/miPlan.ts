import { useQuery } from "@tanstack/react-query";
import { planes as planesApi } from "@/api";
import { useSesion } from "@/lib/store";

/** Mi plan y cuánto llevo usado. Se vuelve a pedir al crear o borrar inventarios. */
export function useMiPlan() {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: ["miPlan", usuario?.id],
    enabled: !!usuario,
    queryFn: planesApi.mio,
  });
}

/** Límites del inventario activo y cuánto lleva usado. Se actualiza al cambiar productos o gente. */
export function useLimitesInventario(inventarioId: string | undefined) {
  return useQuery({
    queryKey: ["limites", inventarioId],
    enabled: !!inventarioId,
    queryFn: () => planesApi.deInventario(inventarioId!),
  });
}
