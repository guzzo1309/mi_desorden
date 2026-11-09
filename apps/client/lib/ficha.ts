import type { FichaInput, Producto } from "@mi-desorden/core";

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