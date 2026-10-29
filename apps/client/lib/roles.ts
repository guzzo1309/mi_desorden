import type { Rol, RolInfo } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { roles as rolesApi } from "@/api";

/** Mientras carga la tabla (o sin red), los nombres de siempre. */
const POR_DEFECTO: Record<Rol, Pick<RolInfo, "nombre" | "descripcion">> = {
  dueño: { nombre: "Dueño", descripcion: "" },
  editor: { nombre: "Editor", descripcion: "" },
  lector: { nombre: "Lector", descripcion: "" },
};

/** Nombre y descripción de cada rol, desde la tabla roles. Cambia poco: se pide una vez. */
export function useRoles() {
  const { data } = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.listar,
    staleTime: Infinity,
  });
  const info = (rol: Rol) => data?.find((r) => r.id === rol) ?? { id: rol, ...POR_DEFECTO[rol] };
  return {
    nombre: (rol: Rol) => info(rol).nombre,
    descripcion: (rol: Rol) => info(rol).descripcion,
  };
}
