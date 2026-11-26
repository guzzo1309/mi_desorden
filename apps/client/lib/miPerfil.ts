import { useQuery } from "@tanstack/react-query";
import { perfil } from "@/api";
import { useSesion } from "@/lib/store";

export const clavePerfil = (uid: string | undefined) => ["perfil", uid] as const;

/** Mi perfil (nombre, teléfono y foto). */
export function useMiPerfil() {
  const { usuario } = useSesion();
  return useQuery({
    queryKey: clavePerfil(usuario?.id),
    queryFn: perfil.mio,
    enabled: !!usuario,
  });
}
