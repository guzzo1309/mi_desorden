import type { Permisos, Rol, RolInfo } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { roles as rolesApi } from "@/api";

/** Cómo se muestra cada rol. */
export const NOMBRE_ROL: Record<Rol, string> = {
  owner: "Owner",
  admin: "Admin",
  employee: "Employee",
};

/**
 * Los mismos permisos que la tabla roles (migración 20261028000100). Se usan
 * mientras carga la tabla o sin red; la base es la que decide de verdad.
 */
const POR_DEFECTO: Record<Rol, Permisos & { descripcion: string }> = {
  owner: {
    descripcion: "",
    ver: true,
    ajustar_stock: true,
    editar_productos: true,
    gestionar_fotos: true,
    gestionar_accesos: true,
    eliminar_inventario: true,
  },
  admin: {
    descripcion: "",
    ver: true,
    ajustar_stock: true,
    editar_productos: true,
    gestionar_fotos: true,
    gestionar_accesos: true,
    eliminar_inventario: false,
  },
  employee: {
    descripcion: "",
    ver: true,
    ajustar_stock: true,
    editar_productos: false,
    gestionar_fotos: false,
    gestionar_accesos: false,
    eliminar_inventario: false,
  },
};

/**
 * ¿Quien tiene `mio` puede dar o quitar el rol `objetivo`? Igual que
 * public.puede_asignar: el owner maneja admins y employees; un admin, solo
 * employees; al owner no lo toca nadie.
 */
export function puedeAsignar(mio: Rol, objetivo: Rol): boolean {
  if (objetivo === "owner") return false;
  if (mio === "owner") return true;
  return mio === "admin" && objetivo === "employee";
}

/** Roles que puedo dar al invitar o cambiar a alguien (de menos a más). */
export const rolesAsignables = (mio: Rol): Exclude<Rol, "owner">[] =>
  (["employee", "admin"] as const).filter((r) => puedeAsignar(mio, r));

/** Descripción y permisos de cada rol, desde la tabla roles. Cambia poco: se pide una vez. */
export function useRoles() {
  const { data } = useQuery({
    queryKey: ["roles"],
    queryFn: rolesApi.listar,
    staleTime: Infinity,
  });
  const fila = (rol: Rol): Permisos & { descripcion: string } =>
    data?.find((r: RolInfo) => r.rol === rol) ?? POR_DEFECTO[rol];
  return {
    nombre: (rol: Rol) => NOMBRE_ROL[rol],
    descripcion: (rol: Rol) => fila(rol).descripcion,
    permisos: (rol: Rol): Permisos => fila(rol),
  };
}
