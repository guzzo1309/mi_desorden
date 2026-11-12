import type { Movimiento } from "@mi-desorden/core";

const CAMPOS: Record<string, string> = {
  nombre: "nombre",
  ubicacion: "ubicación",
  minimo: "mínimo",
  categoria: "categoría",
};

const valor = (v: string | number | null) => (v === null || v === "" ? "—" : String(v));

/**
 * Quién lo hizo, para el renglón: el nombre, con "(tú)" si fuiste tú ("Ana (tú)"),
 * o "Alguien" si la cuenta ya no existe.
 */
export function quienHizo(m: Pick<Movimiento, "usuario_id" | "usuario">, yoId?: string): string {
  const nombre = m.usuario?.nombre;
  if (m.usuario_id && m.usuario_id === yoId) return nombre ? `${nombre} (tú)` : "Tú";
  return nombre ?? "Alguien";
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

export interface Renglon {
  /** El producto, sin comillas: es lo que se lee primero. */
  producto: string;
  /** "Agregado por ti · con la cámara". */
  accion: string;
  /** La cifra a la derecha ("+5", "−2"); null si no hay (una edición). */
  cifra: { texto: string; tono: "sube" | "baja" | "neutro" } | null;
  /** Solo en ediciones: un cambio por línea ("Nombre: Cuaderno → Marcador"). */
  cambios: string[];
}

const conSigno = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/**
 * El renglón del historial, partido como en las apps de Apple: el producto
 * arriba, quién y qué abajo, y la cifra que cambió a la derecha.
 */
export function renglonMovimiento(m: Movimiento, yoId?: string): Renglon {
  const yo = !!m.usuario_id && m.usuario_id === yoId;
  const por = yo ? "por ti" : m.usuario?.nombre ? `por ${m.usuario.nombre}` : "";
  const camara = m.fuente === "camara" ? " · con la cámara" : "";
  const accion = (verbo: string) => [verbo, por].filter(Boolean).join(" ") + camara;
  const antes = m.cantidad_antes ?? 0;
  const despues = m.cantidad_despues ?? 0;

  switch (m.tipo) {
    case "creado":
      return {
        producto: m.producto_nombre,
        accion: accion("Agregado"),
        cifra: { texto: conSigno(despues), tono: despues > 0 ? "sube" : "neutro" },
        cambios: [],
      };
    case "stock": {
      const dif = despues - antes;
      return {
        producto: m.producto_nombre,
        accion: `${accion("Ajustado")} · ${antes} → ${despues}`,
        cifra: { texto: conSigno(dif), tono: dif > 0 ? "sube" : dif < 0 ? "baja" : "neutro" },
        cambios: [],
      };
    }
    case "editado": {
      const cambios = Object.entries(m.detalle ?? {}).map(([k, c]) => {
        const campo = CAMPOS[k] ?? k;
        return `${campo.charAt(0).toUpperCase()}${campo.slice(1)}: ${valor(c.de)} → ${valor(c.a)}`;
      });
      return { producto: m.producto_nombre, accion: accion("Editado"), cifra: null, cambios };
    }
    case "eliminado":
      return {
        producto: m.producto_nombre,
        accion: accion("Eliminado"),
        cifra: { texto: conSigno(-antes), tono: antes > 0 ? "baja" : "neutro" },
        cambios: [],
      };
  }
}

/** "11:55 a. m." / "2:01 p. m." (sin depender del Intl del teléfono). */
export function horaAmPm(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h < 12 ? "a. m." : "p. m."}`;
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
