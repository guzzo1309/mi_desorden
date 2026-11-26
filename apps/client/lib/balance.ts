import type { AdminBalance, FiltroBalance } from "@mi-desorden/core";
import { DocumentoPdf, partirLineas, recortar } from "@/lib/pdf";

/**
 * Balance administrativo: el filtro (año, mes o día), sus textos y el PDF.
 *
 * El PDF se arma con la misma respuesta de admin_balance que se ve en la
 * pantalla: lo que se descarga es exactamente lo que dice la base para ese filtro.
 */

/** Tope del archivo. Con el tope de filas del detalle (500) un balance queda muy por debajo. */
export const TAMANO_MAX_PDF = 1024 * 1024;

export type NivelBalance = "anio" | "mes" | "dia";

export const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = MESES.map((m) => m.slice(0, 3));

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const nivelDe = (f: FiltroBalance): NivelBalance =>
  f.dia !== null ? "dia" : f.mes !== null ? "mes" : "anio";

export const diasDelMes = (anio: number, mes: number) => new Date(anio, mes, 0).getDate();

/** El filtro del período que contiene a `hoy`, al nivel pedido. */
export function filtroDeHoy(nivel: NivelBalance, hoy = new Date()): FiltroBalance {
  return {
    anio: hoy.getFullYear(),
    mes: nivel === "anio" ? null : hoy.getMonth() + 1,
    dia: nivel === "dia" ? hoy.getDate() : null,
  };
}

/**
 * Cambia de nivel conservando lo que se pueda: de "noviembre 2026" a día queda el
 * día 1 (o hoy si es este mes); de un día a año queda ese año.
 */
export function cambiarNivel(
  f: FiltroBalance,
  nivel: NivelBalance,
  hoy = new Date(),
): FiltroBalance {
  if (nivel === "anio") return { anio: f.anio, mes: null, dia: null };
  const esteAnio = f.anio === hoy.getFullYear();
  const mes = f.mes ?? (esteAnio ? hoy.getMonth() + 1 : 1);
  if (nivel === "mes") return { anio: f.anio, mes, dia: null };
  const esteMes = esteAnio && mes === hoy.getMonth() + 1;
  return { anio: f.anio, mes, dia: f.dia ?? (esteMes ? hoy.getDate() : 1) };
}

/** El período anterior (-1) o el siguiente (+1), al mismo nivel. */
export function moverPeriodo(f: FiltroBalance, paso: -1 | 1): FiltroBalance {
  if (f.mes === null) return { anio: f.anio + paso, mes: null, dia: null };
  if (f.dia === null) {
    const d = new Date(f.anio, f.mes - 1 + paso, 1);
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: null };
  }
  const d = new Date(f.anio, f.mes - 1, f.dia + paso);
  return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() };
}

/** ¿El período empieza después de hoy? (No hay ganancias del futuro.) */
export function esFuturo(f: FiltroBalance, hoy = new Date()): boolean {
  const inicio = new Date(f.anio, (f.mes ?? 1) - 1, f.dia ?? 1);
  return inicio.getTime() > hoy.getTime();
}

/** "2026", "Noviembre 2026" o "25 de noviembre de 2026". */
export function etiquetaPeriodo(f: FiltroBalance): string {
  if (f.mes === null) return String(f.anio);
  if (f.dia === null) return `${mayuscula(MESES[f.mes - 1]!)} ${f.anio}`;
  return `${f.dia} de ${MESES[f.mes - 1]} de ${f.anio}`;
}

/** balance-2026.pdf, balance-2026-11.pdf o balance-2026-11-25.pdf. */
export function nombreArchivo(f: FiltroBalance): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  const partes = [String(f.anio)];
  if (f.mes !== null) partes.push(dos(f.mes));
  if (f.dia !== null) partes.push(dos(f.dia));
  return `balance-${partes.join("-")}.pdf`;
}

/** "1.200": entero con punto de miles. */
export const entero = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** "$1.234,50": separador de miles con punto y siempre dos decimales. */
export function moneda(n: number): string {
  const negativo = n < 0;
  const [parteEntera, decimales] = Math.abs(n).toFixed(2).split(".");
  const miles = parteEntera!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativo ? "-" : ""}$${miles},${decimales}`;
}

/** "2026-11-25" → "25 nov 2026". */
export function diaCorto(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return `${d} ${MESES_CORTOS[m! - 1]} ${a}`;
}

/** Etiqueta de una fila de la serie: "Noviembre" (YYYY-MM) o "25 nov" (YYYY-MM-DD). */
export function etiquetaSerie(periodo: string): string {
  const [, m, d] = periodo.split("-").map(Number);
  return d ? `${d} ${MESES_CORTOS[m! - 1]}` : mayuscula(MESES[m! - 1]!);
}

/** "25 nov 2026" (o con la hora) en la zona del balance, con respaldo a la hora del teléfono. */
function fechaEnZona(iso: string, zona: string, conHora = false): string {
  const fecha = new Date(iso);
  const opciones: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
  };
  try {
    return fecha.toLocaleString("es", { ...opciones, timeZone: zona });
  } catch {
    return fecha.toLocaleString("es", opciones);
  }
}

/** Números de la respuesta: PostgREST puede mandar los numeric como texto. */
export function normalizarBalance(b: AdminBalance): AdminBalance {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    ...b,
    total: n(b.total),
    cobros: n(b.cobros),
    cuentas: n(b.cuentas),
    detalle_total: n(b.detalle_total),
    por_plan: (b.por_plan ?? []).map((p) => ({ ...p, cobros: n(p.cobros), total: n(p.total) })),
    serie: (b.serie ?? []).map((s) => ({ ...s, cobros: n(s.cobros), total: n(s.total) })),
    detalle: (b.detalle ?? []).map((c) => ({ ...c, monto: n(c.monto) })),
  };
}

/* ---------- PDF ---------- */

const COLOR = {
  marca: "#C46A14",
  texto: "#1C1C1E",
  gris: "#6E6E73",
  linea: "#D1D1D6",
  fondo: "#F2F2F7",
  blanco: "#FFFFFF",
};

const MARGEN = 48;
const PIE = 40;

interface Columna {
  titulo: string;
  ancho: number;
  alinear?: "izquierda" | "derecha";
}

/**
 * El balance como PDF: encabezado, totales, por plan, por mes o día y el detalle de
 * cobros. Si el archivo pasa de TAMANO_MAX_PDF, falla en vez de generar algo enorme.
 */
export function pdfBalance(b: AdminBalance): Uint8Array {
  const doc = new DocumentoPdf();
  const ancho = doc.ancho - MARGEN * 2;
  const limite = doc.alto - MARGEN - PIE;
  const periodo = etiquetaPeriodo(b.filtro);
  let y = 0;

  /** Si lo que sigue (alto) no entra, página nueva. Devuelve true si cambió de página. */
  const lugar = (alto: number) => {
    if (y + alto <= limite) return false;
    doc.nuevaPagina();
    y = MARGEN;
    return true;
  };

  // Encabezado de color.
  doc.rect(0, 0, doc.ancho, 112, COLOR.marca);
  doc.texto(MARGEN, 44, "MI DESORDEN", { tam: 10, fuente: "negrita", color: COLOR.blanco });
  doc.texto(MARGEN, 76, "Balance administrativo", {
    tam: 24,
    fuente: "negrita",
    color: COLOR.blanco,
  });
  doc.texto(doc.ancho - MARGEN, 44, "Período", {
    tam: 10,
    color: COLOR.blanco,
    alinear: "derecha",
  });
  doc.texto(doc.ancho - MARGEN, 76, periodo, {
    tam: 16,
    fuente: "negrita",
    color: COLOR.blanco,
    alinear: "derecha",
  });

  // Datos del reporte.
  y = 140;
  const ultimoDia = new Date(new Date(b.hasta).getTime() - 1).toISOString();
  const rango =
    nivelDe(b.filtro) === "dia"
      ? periodo
      : `${fechaEnZona(b.desde, b.filtro.zona)} al ${fechaEnZona(ultimoDia, b.filtro.zona)}`;
  const meta: [string, string][] = [
    ["Período", rango],
    ["Zona horaria", b.filtro.zona],
    [
      "Generado",
      `${fechaEnZona(b.generado_en, b.filtro.zona, true)}${b.generado_por ? ` por ${b.generado_por}` : ""}`,
    ],
  ];
  for (const [etiqueta, valor] of meta) {
    doc.texto(MARGEN, y, etiqueta, { tam: 9, color: COLOR.gris });
    doc.texto(MARGEN + 90, y, recortar(valor, ancho - 90, 9), { tam: 9, color: COLOR.texto });
    y += 14;
  }

  // Totales en tres cajas.
  y += 12;
  const caja = (ancho - 16) / 3;
  const cajas: [string, string, boolean][] = [
    ["Ganancias", moneda(b.total), true],
    ["Cobros", entero(b.cobros), false],
    ["Cuentas que pagaron", entero(b.cuentas), false],
  ];
  cajas.forEach(([etiqueta, valor, destacada], i) => {
    const x = MARGEN + i * (caja + 8);
    doc.rect(x, y, caja, 62, destacada ? COLOR.marca : COLOR.fondo);
    const color = destacada ? COLOR.blanco : COLOR.texto;
    doc.texto(x + 12, y + 20, etiqueta, { tam: 9, color: destacada ? COLOR.blanco : COLOR.gris });
    doc.texto(x + 12, y + 46, recortar(valor, caja - 24, 20, "negrita"), {
      tam: 20,
      fuente: "negrita",
      color,
    });
  });
  y += 62 + 28;

  /** Texto chico en gris, partido en las líneas que hagan falta. */
  const nota = (texto: string) => {
    for (const linea of partirLineas(texto, ancho, 8)) {
      lugar(12);
      doc.texto(MARGEN, y, linea, { tam: 8, color: COLOR.gris });
      y += 11;
    }
  };

  const titulo = (texto: string, aparte?: string) => {
    lugar(60);
    doc.texto(MARGEN, y, texto, { tam: 13, fuente: "negrita", color: COLOR.texto });
    if (aparte) {
      doc.texto(doc.ancho - MARGEN, y, aparte, { tam: 9, color: COLOR.gris, alinear: "derecha" });
    }
    y += 12;
  };

  /** Tabla con encabezado; si sigue en otra página, repite el encabezado. */
  const tabla = (columnas: Columna[], filas: string[][], pie?: string[]) => {
    const altoFila = 20;
    const escala = ancho / columnas.reduce((a, c) => a + c.ancho, 0);
    const xs: number[] = [];
    columnas.reduce((x, c) => (xs.push(x), x + c.ancho * escala), MARGEN);

    const celdas = (valores: string[], negrita: boolean, color: string) => {
      columnas.forEach((c, i) => {
        const w = c.ancho * escala;
        const texto = recortar(valores[i] ?? "", w - 12, 9, negrita ? "negrita" : "normal");
        const derecha = c.alinear === "derecha";
        doc.texto(derecha ? xs[i]! + w - 6 : xs[i]! + 6, y + 13.5, texto, {
          tam: 9,
          fuente: negrita ? "negrita" : "normal",
          color,
          alinear: derecha ? "derecha" : "izquierda",
        });
      });
    };
    const encabezado = () => {
      doc.rect(MARGEN, y, ancho, altoFila, COLOR.fondo);
      celdas(
        columnas.map((c) => c.titulo),
        true,
        COLOR.gris,
      );
      y += altoFila;
    };

    lugar(altoFila * 2);
    encabezado();
    for (const fila of filas) {
      if (lugar(altoFila)) encabezado();
      celdas(fila, false, COLOR.texto);
      doc.linea(MARGEN, y + altoFila, MARGEN + ancho, y + altoFila, COLOR.linea);
      y += altoFila;
    }
    if (pie) {
      if (lugar(altoFila)) encabezado();
      celdas(pie, true, COLOR.texto);
      y += altoFila;
    }
    y += 24;
  };

  if (!b.cobros) {
    titulo("Sin ganancias");
    doc.texto(MARGEN, y + 8, "No hubo cobros de planes pagos en este período.", {
      tam: 10,
      color: COLOR.gris,
    });
    y += 36;
  } else {
    titulo("Por plan");
    tabla(
      [
        { titulo: "Plan", ancho: 4 },
        { titulo: "Cobros", ancho: 2, alinear: "derecha" },
        { titulo: "% del total", ancho: 2, alinear: "derecha" },
        { titulo: "Total", ancho: 2.5, alinear: "derecha" },
      ],
      b.por_plan.map((p) => [
        p.plan,
        entero(p.cobros),
        `${b.total ? Math.round((p.total / b.total) * 1000) / 10 : 0} %`.replace(".", ","),
        moneda(p.total),
      ]),
      ["Total", entero(b.cobros), "100 %", moneda(b.total)],
    );

    if (b.serie.length) {
      titulo(nivelDe(b.filtro) === "anio" ? "Por mes" : "Por día");
      tabla(
        [
          { titulo: nivelDe(b.filtro) === "anio" ? "Mes" : "Día", ancho: 6 },
          { titulo: "Cobros", ancho: 2, alinear: "derecha" },
          { titulo: "Total", ancho: 2.5, alinear: "derecha" },
        ],
        b.serie.map((s) => [etiquetaSerie(s.periodo), entero(s.cobros), moneda(s.total)]),
      );
    }

    const cortado = b.detalle_total > b.detalle.length;
    titulo(
      "Detalle de cobros",
      cortado ? `Primeros ${entero(b.detalle.length)} de ${entero(b.detalle_total)}` : undefined,
    );
    tabla(
      [
        { titulo: "Fecha", ancho: 2 },
        { titulo: "Cuenta", ancho: 2.6 },
        { titulo: "Correo", ancho: 3.4 },
        { titulo: "Plan", ancho: 1.8 },
        { titulo: "Monto", ancho: 1.8, alinear: "derecha" },
      ],
      b.detalle.map((c) => [diaCorto(c.dia), c.cuenta, c.email, c.plan, moneda(c.monto)]),
    );
    if (cortado) {
      y -= 12;
      nota(
        `El detalle muestra los primeros ${b.detalle.length} cobros para que el archivo no sea muy pesado; los totales incluyen los ${b.detalle_total}.`,
      );
      y += 12;
    }
  }

  nota(
    "Las ganancias se calculan con las suscripciones a planes pagos: cada una cobra su precio mensual el día que empieza y cada mes mientras sigue vigente, con el precio que tenía el plan al contratarse.",
  );

  // Pie en cada página.
  const total = doc.totalPaginas;
  for (let i = 0; i < total; i++) {
    doc.irAPagina(i);
    const yPie = doc.alto - MARGEN + 12;
    doc.linea(MARGEN, yPie - 14, doc.ancho - MARGEN, yPie - 14, COLOR.linea);
    doc.texto(MARGEN, yPie, `MI DESORDEN · Balance administrativo · ${periodo}`, {
      tam: 8,
      color: COLOR.gris,
    });
    doc.texto(doc.ancho - MARGEN, yPie, `Página ${i + 1} de ${total}`, {
      tam: 8,
      color: COLOR.gris,
      alinear: "derecha",
    });
  }

  const bytes = doc.generar({
    titulo: `Balance administrativo · ${periodo}`,
    autor: b.generado_por ?? "MI DESORDEN",
  });
  if (bytes.length > TAMANO_MAX_PDF) {
    throw new Error(
      `El PDF pesa más de ${Math.round(TAMANO_MAX_PDF / 1024)} KB. Elige un período más corto.`,
    );
  }
  return bytes;
}