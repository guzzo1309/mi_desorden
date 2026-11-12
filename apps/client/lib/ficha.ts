import type { Especificacion, FichaInput, Producto } from "@mi-desorden/core";

/** Los campos del producto que forman la ficha técnica. */
type ConFicha = Partial<Pick<Producto, "descripcion" | "marca" | "codigo" | "especificaciones">>;

/**
 * La ficha de un producto, con valores vacíos si todavía no tiene.
 * Así las pantallas no fallan con productos viejos o si falta la migración.
 */
export function fichaDe(producto: ConFicha): FichaInput {
  return {
    marca: producto.marca ?? "",
    codigo: producto.codigo ?? "",
    especificaciones: Array.isArray(producto.especificaciones)
      ? producto.especificaciones.filter(
          (e) => e && typeof e.campo === "string" && typeof e.valor === "string",
        )
      : [],
  };
}

/** True si la ficha tiene algo para mostrar (la descripción cuenta). */
export function tieneFicha(producto: ConFicha): boolean {
  const f = fichaDe(producto);
  return Boolean(
    producto.descripcion?.trim() ||
      f.marca.trim() ||
      f.codigo.trim() ||
      f.especificaciones.some((e) => e.valor.trim()),
  );
}

/** Resumen corto para la cámara: marca · código · primera línea de la descripción. */
export function resumenFicha(producto: ConFicha): string {
  const f = fichaDe(producto);
  const primeraLinea = (producto.descripcion ?? "").split("\n")[0].trim();
  return [f.marca, f.codigo, primeraLinea].filter(Boolean).join(" · ");
}

/** Límites de la ficha técnica: los mismos que los check de la migración. */
export const FICHA_LIMITES = {
  marca: 80,
  codigo: 80,
  especificaciones: 20,
  campo: 40,
  valor: 120,
} as const;

/** Campos que se proponen al editar una ficha vacía: se pueden borrar o renombrar. */
export const CAMPOS_SUGERIDOS = ["Peso", "Medidas", "Material", "Color"];

/**
 * Lo que se guarda: sin espacios de más, sin filas vacías y dentro de los límites.
 * Una fila con valor pero sin nombre de campo queda como "Dato".
 */
export function limpiarFicha(f: FichaInput): FichaInput {
  const especificaciones: Especificacion[] = f.especificaciones
    .map((e) => ({ campo: e.campo.trim(), valor: e.valor.trim() }))
    .filter((e) => e.valor.length > 0)
    .map((e) => ({
      campo: (e.campo || "Dato").slice(0, FICHA_LIMITES.campo),
      valor: e.valor.slice(0, FICHA_LIMITES.valor),
    }))
    .slice(0, FICHA_LIMITES.especificaciones);
  return {
    marca: f.marca.trim().slice(0, FICHA_LIMITES.marca),
    codigo: f.codigo.trim().slice(0, FICHA_LIMITES.codigo),
    especificaciones,
  };
}

/** True si la ficha cambió respecto de la guardada (comparando ya limpias). */
export function fichaCambio(antes: FichaInput, despues: FichaInput): boolean {
  return JSON.stringify(limpiarFicha(antes)) !== JSON.stringify(limpiarFicha(despues));
}

/** Filas para empezar a editar: las que hay, o las sugeridas si está vacía. */
export function filasParaEditar(f: FichaInput): Especificacion[] {
  return f.especificaciones.length
    ? f.especificaciones
    : CAMPOS_SUGERIDOS.map((campo) => ({ campo, valor: "" }));
}

/** Explica el error de la base cuando todavía no se aplicó la migración. */
export function errorFicha(mensaje: string): string {
    if (/column/i.test(mensaje) && /(marca|codigo|especificaciones)/i.test(mensaje)) {
    return "La base de datos todavía no tiene la ficha técnica: falta aplicar la migración 20261108000000_ficha_tecnica.sql en Supabase.";
  }
  return mensaje;
}