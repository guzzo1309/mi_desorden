import type { Producto } from "@mi-desorden/core";
import { FOTOS_RECOMENDADAS, rutasDe } from "@/lib/fotos";
import { esPorReponer } from "@/lib/stock";

type Base = Pick<Producto, "cantidad" | "minimo" | "categoria_id" | "foto_path" | "fotos_extra">;

/** Se acabó: cantidad 0 (aunque no tenga mínimo definido). */
export const esAgotado = (p: Pick<Producto, "cantidad">) => p.cantidad === 0;

/** Menos de 2 fotos: la cámara lo reconoce peor. */
export const pocasFotos = (p: Pick<Producto, "foto_path" | "fotos_extra">) =>
  rutasDe(p).length < FOTOS_RECOMENDADAS;

export const sinCategoria = (p: Pick<Producto, "categoria_id">) => !p.categoria_id;

/** Los chips que filtran la lista desde el resumen. */
export type ChipFiltro = "pocasFotos" | "sinCategoria";

export const coincideChip = (p: Base, chip: ChipFiltro) =>
  chip === "pocasFotos" ? pocasFotos(p) : sinCategoria(p);

/** Porcentaje entero de `parte` sobre `total` (sin nada que medir, 100). */
export const porcentaje = (parte: number, total: number) =>
  total > 0 ? Math.round((parte / total) * 100) : 100;

/** Qué tan bien está un porcentaje: bien desde `bien`, medio desde `medio`, mal por debajo. */
export function nivelSalud(
  pct: number,
  { bien, medio }: { bien: number; medio: number },
): "bien" | "medio" | "mal" {
  return pct >= bien ? "bien" : pct >= medio ? "medio" : "mal";
}

/** Los números del resumen de un inventario. */
export function contarResumen(productos: Base[]) {
  const reponer = productos.filter(esPorReponer).length;
  const pocas = productos.filter(pocasFotos).length;
  return {
    total: productos.length,
    /** % de productos sobre su mínimo. */
    pctEnRegla: porcentaje(productos.length - reponer, productos.length),
    /** % de productos con 2 o más fotos: la cámara los reconoce mejor. */
    pctCamaraLista: porcentaje(productos.length - pocas, productos.length),
    unidades: productos.reduce((a, p) => a + p.cantidad, 0),
    reponer,
    agotados: productos.filter(esAgotado).length,
    pocasFotos: pocas,
    sinCategoria: productos.filter(sinCategoria).length,
  };
}

/** "1 agotado" / "3 agotados"; vacío si no hay. */
export const textoAgotados = (n: number) =>
  n > 0 ? `${n} ${n === 1 ? "agotado" : "agotados"}` : "";
