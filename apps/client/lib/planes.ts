import type { CercaDelLimite, Periodo, Plan } from "@mi-desorden/core";

type Limites = Pick<Plan, "max_inventarios" | "max_productos" | "max_personas"> &
  Partial<Pick<Plan, "max_categorias">>;

/** "5", o "Sin límite" si el límite es null. */
export const textoLimite = (n: number | null) =>
  n === null ? "Sin límite" : n.toLocaleString("es");

/** "1 inventario · 10 categorías · 100 productos · 2 personas", para listas. */
export function resumenLimites(p: Limites): string {
  const parte = (n: number | null, uno: string, varios: string) =>
    n === null ? `${varios} sin límite` : `${n.toLocaleString("es")} ${n === 1 ? uno : varios}`;
  return [
    parte(p.max_inventarios, "inventario", "inventarios"),
    // undefined = la base todavía no tiene ese límite: no se muestra.
    p.max_categorias !== undefined ? parte(p.max_categorias, "categoría", "categorías") : null,
    parte(p.max_productos, "producto", "productos"),
    parte(p.max_personas, "persona", "personas"),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** "$48" o "$4,80": sin decimales si es entero, si no con dos. */
export function dinero(n: number): string {
  const entero = Math.round(n * 100) % 100 === 0;
  return `$${n.toLocaleString("es", {
    minimumFractionDigits: entero ? 0 : 2,
    maximumFractionDigits: entero ? 0 : 2,
  })}`;
}

const SUFIJO: Record<Periodo, string> = { mensual: "/ mes", anual: "/ año" };

/** "$9,99 / mes", o "Gratis" en 0 y "—" si no tiene precio cargado. */
export function textoPrecio(precio: number | null, periodo: Periodo = "mensual"): string {
  if (precio === null) return "—";
  if (precio === 0) return "Gratis";
  return `${dinero(precio)} ${SUFIJO[periodo]}`;
}

/** El precio partido para mostrarlo grande: { monto: "$5", periodo: "/ mes" }. */
export function partesPrecio(
  precio: number | null,
  periodo: Periodo = "mensual",
): { monto: string; periodo: string | null } {
  if (precio === null) return { monto: "—", periodo: null };
  if (precio === 0) return { monto: "Gratis", periodo: null };
  return { monto: dinero(precio), periodo: SUFIJO[periodo] };
}

/** Lo que cuesta el plan en ese período: el anual, si no tiene, es 12 meses. */
export function precioDe(
  plan: Pick<Plan, "precio_mensual" | "precio_anual">,
  periodo: Periodo,
): number | null {
  if (plan.precio_mensual === null) return null;
  if (periodo === "mensual") return plan.precio_mensual;
  return plan.precio_anual ?? Math.round(plan.precio_mensual * 12 * 100) / 100;
}

/** Cuánto se ahorra pagando el año (en %, redondeado); null si no hay descuento. */
export function ahorroAnual(plan: Pick<Plan, "precio_mensual" | "precio_anual">): number | null {
  const mes = plan.precio_mensual;
  const anio = plan.precio_anual;
  if (!mes || anio === null || anio === undefined) return null;
  const pct = Math.round((1 - anio / (mes * 12)) * 100);
  return pct > 0 ? pct : null;
}

/** El mayor ahorro entre los planes, para el selector Mensual / Anual. */
export const mayorAhorro = (planes: Pick<Plan, "precio_mensual" | "precio_anual">[]) =>
  planes.reduce<number | null>((max, p) => {
    const a = ahorroAnual(p);
    return a !== null && (max === null || a > max) ? a : max;
  }, null);

/** Convierte el texto de un campo numérico: vacío = sin límite (null), inválido = undefined. */
export function leerLimite(texto: string): number | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  if (!/^\d+$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 ? n : undefined;
}

/** Cuánto del cupo se usó: lleno al llegar al límite, cerca desde el 80 %. Sin límite, siempre libre. */
export function nivelCupo(usados: number, max: number | null): "libre" | "cerca" | "lleno" {
  if (max === null) return "libre";
  if (usados >= max) return "lleno";
  return usados >= max * 0.8 ? "cerca" : "libre";
}

/** "1 de 1 inventarios"; categorías, productos y personas dicen en cuál inventario pasa. */
export function textoCerca(c: {
  recurso: CercaDelLimite["recurso"];
  inventario: string | null;
  usados: number;
  max: number;
}): string {
  const donde = c.inventario ? ` en “${c.inventario}”` : "";
  const recurso = c.recurso === "categorias" ? "categorías" : c.recurso;
  return `${c.usados} de ${c.max} ${recurso}${donde}`;
}

/** Cómo se llama y de qué color va el estado de un pedido de plan resuelto. */
export function estadoPedido(estado: "aprobado" | "rechazado" | "cancelado"): {
  texto: string;
  color: "verde" | "rojo" | "gris";
} {
  switch (estado) {
    case "aprobado":
      return { texto: "Aprobado", color: "verde" };
    case "rechazado":
      return { texto: "Rechazado", color: "rojo" };
    case "cancelado":
      return { texto: "Cancelado por el owner", color: "gris" };
  }
}

/** Una cuenta cerca del límite con todo lo que tiene casi lleno, lo más lleno primero. */
export interface CuentaCerca {
  usuario_id: string;
  nombre: string;
  plan: string;
  recursos: CercaDelLimite[];
  /** Cuántos recursos ya llegaron al tope. */
  llenos: number;
  /** El más lleno, de 0 a 1 (o más si se pasó). */
  peor: number;
}

/** Junta por cuenta las filas de "cerca del límite"; primero las que tienen más topes llenos. */
export function agruparCerca(cerca: CercaDelLimite[]): CuentaCerca[] {
  const porCuenta = new Map<string, CuentaCerca>();
  for (const c of cerca) {
    const cuenta = porCuenta.get(c.usuario_id) ?? {
      usuario_id: c.usuario_id,
      nombre: c.nombre,
      plan: c.plan,
      recursos: [],
      llenos: 0,
      peor: 0,
    };
    cuenta.recursos.push(c);
    if (c.usados >= c.max) cuenta.llenos++;
    cuenta.peor = Math.max(cuenta.peor, c.usados / c.max);
    porCuenta.set(c.usuario_id, cuenta);
  }
  return [...porCuenta.values()]
    .map((c) => ({
      ...c,
      recursos: [...c.recursos].sort((a, b) => b.usados / b.max - a.usados / a.max),
    }))
    .sort((a, b) => b.llenos - a.llenos || b.peor - a.peor || a.nombre.localeCompare(b.nombre));
}
