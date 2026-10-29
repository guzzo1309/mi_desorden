import type { Movimiento } from "@mi-desorden/core";

const CAMPOS: Record<string, string> = {
  nombre: "nombre",
  ubicacion: "ubicación",
  minimo: "mínimo",
  categoria: "categoría",
};

const valor = (v: string | number | null) => (v === null || v === "" ? "—" : String(v));

/** Quién lo hizo, para el renglón: "Vos", el nombre, o "Alguien" si la cuenta ya no existe. */
export function quienHizo(m: Pick<Movimiento, "usuario_id" | "usuario">, yoId?: string): string {
  if (m.usuario_id && m.usuario_id === yoId) return "Vos";
  return m.usuario?.nombre ?? "Alguien";
}

/** Título y detalle de un movimiento, ya en castellano. */
export function textoMovimiento(m: Movimiento, yoId?: string): { titulo: string; detalle: string } {
  const quien = quienHizo(m, yoId);
  const producto = `«${m.producto_nombre}»`;
  const camara = m.fuente === "camara" ? " · con la cámara" : "";
  switch (m.tipo) {
    case "creado":
      return {
        titulo: `${quien} agregó ${producto}`,
        detalle: `${m.cantidad_despues ?? 0} ${m.cantidad_despues === 1 ? "unidad" : "unidades"}${camara}`,
      };
    case "stock":
      return {
        titulo: `${quien} ajustó ${producto}`,
        detalle: `${m.cantidad_antes ?? 0} → ${m.cantidad_despues ?? 0}${camara}`,
      };
    case "editado": {
      const campos = Object.entries(m.detalle ?? {});
      return {
        titulo: `${quien} editó ${producto}`,
        detalle: campos
          .map(([k, c]) => `${CAMPOS[k] ?? k}: ${valor(c.de)} → ${valor(c.a)}`)
          .join(" · "),
      };
    }
    case "eliminado":
      return {
        titulo: `${quien} eliminó ${producto}`,
        detalle: `Tenía ${m.cantidad_antes ?? 0} ${m.cantidad_antes === 1 ? "unidad" : "unidades"}`,
      };
  }
}

/** "Hoy", "Ayer" o la fecha. `ahora` se pasa para poder probarlo. */
export function etiquetaDia(iso: string, ahora = new Date()): string {
  const d = new Date(iso);
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(ahora) - dia(d)) / 86_400_000);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Ayer";
  return d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
}

/** Agrupa renglones consecutivos por día (llegan del más nuevo al más viejo). */
export function agruparPorDia(
  lista: Movimiento[],
  ahora = new Date(),
): { dia: string; items: Movimiento[] }[] {
  const grupos: { dia: string; items: Movimiento[] }[] = [];
  for (const m of lista) {
    const dia = etiquetaDia(m.creado_en, ahora);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.items.push(m);
    else grupos.push({ dia, items: [m] });
  }
  return grupos;
}
