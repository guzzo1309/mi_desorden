import type { FuenteTitulo, Inventario } from "@mi-desorden/core";

export interface OpcionFuente {
  id: FuenteTitulo;
  etiqueta: string;
  ejemplo: string;
  fuentes: { ios?: string; android?: string; web?: string };
}

/** Fuentes disponibles para el título de un catálogo (el usuario elige como máximo una). */
export const FUENTES_TITULO: readonly OpcionFuente[] = [
  {
    id: "sistema",
    etiqueta: "Sistema",
    ejemplo: "Predeterminada",
    fuentes: {},
  },
  {
    id: "redondeada",
    etiqueta: "Redondeada",
    ejemplo: "Amigable",
    fuentes: { ios: "ui-rounded", android: "sans-serif-medium", web: "ui-rounded, sans-serif" },
  },
  {
    id: "serif",
    etiqueta: "Clásica",
    ejemplo: "Editorial",
    fuentes: { ios: "Georgia", android: "serif", web: "Georgia, serif" },
  },
  {
    id: "monoespaciada",
    etiqueta: "Técnica",
    ejemplo: "Monoespaciada",
    fuentes: { ios: "Menlo", android: "monospace", web: "monospace" },
  },
];

export interface OpcionColor {
  /** Hex #RRGGBB o null para usar el color del tema. */
  valor: string | null;
  etiqueta: string;
}

/** Colores disponibles para el título del catálogo (el usuario elige como máximo uno). */
export const COLORES_TITULO: readonly OpcionColor[] = [
  { valor: null, etiqueta: "Predeterminado" },
  { valor: "#C46A14", etiqueta: "Ámbar" },
  { valor: "#007AFF", etiqueta: "Azul" },
  { valor: "#34C759", etiqueta: "Verde" },
  { valor: "#FF3B30", etiqueta: "Rojo" },
  { valor: "#AF52DE", etiqueta: "Violeta" },
  { valor: "#5856D6", etiqueta: "Índigo" },
  { valor: "#FF2D55", etiqueta: "Rosa" },
  { valor: "#3A3A3C", etiqueta: "Grafito" },
];

const IDS_FUENTE = new Set<string>(FUENTES_TITULO.map((f) => f.id));
const HEX_VALIDO = /^#[0-9A-Fa-f]{6}$/;

/** Garantiza que como máximo se guarde 1 fuente válida (o null). */
export function normalizarFuente(valor: string | null | undefined): FuenteTitulo | null {
  if (!valor) return null;
  const limpio = valor.trim();
  return IDS_FUENTE.has(limpio) ? (limpio as FuenteTitulo) : null;
}

/** Garantiza que como máximo se guarde 1 color hex válido en mayúsculas (o null). */
export function normalizarColor(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const limpio = valor.trim();
  return HEX_VALIDO.test(limpio) ? limpio.toUpperCase() : null;
}

/** Devuelve el `fontFamily` correspondiente a una fuente elegida según la plataforma. */
export function fontFamilyDe(
  fuente: FuenteTitulo | null | undefined,
  os: "ios" | "android" | "web" | string = "ios",
): string | undefined {
  if (!fuente) return undefined;
  const opcion = FUENTES_TITULO.find((f) => f.id === fuente);
  if (!opcion) return undefined;
  if (os === "android") return opcion.fuentes.android;
  if (os === "web") return opcion.fuentes.web;
  return opcion.fuentes.ios ?? opcion.fuentes.web;
}

/** Estilo de texto listo para aplicar al título de un catálogo/inventario. */
export function estiloTituloCatalogo(
  inv: Pick<Inventario, "fuente_titulo" | "color_titulo"> | null | undefined,
  colorTema: string,
  os: string = "ios",
): { color: string; fontFamily?: string } {
  const color = normalizarColor(inv?.color_titulo) ?? colorTema;
  const fontFamily = fontFamilyDe(normalizarFuente(inv?.fuente_titulo), os);
  return fontFamily ? { color, fontFamily } : { color };
}
