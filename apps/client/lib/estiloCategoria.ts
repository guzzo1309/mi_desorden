import type { Categoria, ColorCategoria, ColorPaleta, FuenteCategoria } from "@mi-desorden/core";
import type { Tema } from "@/lib/theme";

/**
 * Personalización de una categoría (solo el owner): estilo de letra y color del
 * título. Las letras son las que ya trae el teléfono: no hay que bajar nada
 * (la familia de cada una está en components/EstiloCategoria, que depende de la plataforma).
 */

export const FUENTES: { valor: FuenteCategoria | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Sistema" },
  { valor: "redondeada", etiqueta: "Redondeada" },
  { valor: "serif", etiqueta: "Clásica" },
  { valor: "mono", etiqueta: "Máquina de escribir" },
  { valor: "condensada", etiqueta: "Angosta" },
];

export const COLORES: { valor: ColorPaleta | null; etiqueta: string }[] = [
  { valor: null, etiqueta: "Normal" },
  { valor: "marca", etiqueta: "Ámbar" },
  { valor: "kraft", etiqueta: "Kraft" },
  { valor: "rojo", etiqueta: "Rojo" },
  { valor: "verde", etiqueta: "Verde" },
  { valor: "azul", etiqueta: "Azul" },
  { valor: "violeta", etiqueta: "Violeta" },
];

/** ¿Es un color libre (#RRGGBB) y no uno de la paleta? */
export const esColorLibre = (color: string | null | undefined): color is `#${string}` =>
  !!color && /^#[0-9a-f]{6}$/i.test(color);

/** El color del título en el tema actual (claro u oscuro); sin color, el del texto. */
export function colorDe(color: ColorCategoria | null | undefined, t: Tema): string {
  if (!color) return t.texto;
  if (esColorLibre(color)) return color;
  if (color.startsWith("#")) return t.texto; // un # mal formado: mejor el de siempre
  return color === "marca" ? t.tinte : t[color as Exclude<ColorPaleta, "marca">];
}

/** HSL (tono 0–360, saturación y luz 0–100) → #RRGGBB en mayúsculas. */
export function hslAHex(h: number, s: number, l: number): `#${string}` {
  const sat = s / 100;
  const luz = l / 100;
  const a = sat * Math.min(luz, 1 - luz);
  const canal = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = luz - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${canal(0)}${canal(8)}${canal(4)}`.toUpperCase() as `#${string}`;
}

/**
 * Lo que escribe la persona en el campo de color → #RRGGBB, o null si no es un color.
 * Acepta con o sin #, en minúsculas y la forma corta (#F80).
 */
export function normalizarHex(texto: string): `#${string}` | null {
  let h = texto.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(h) ? (`#${h.toUpperCase()}` as `#${string}`) : null;
}

/** ¿La categoría tiene algo personalizado? */
export const estaPersonalizada = (c: Pick<Categoria, "imagen_path" | "fuente" | "color">) =>
  !!(c.imagen_path || c.fuente || c.color);

/**
 * La categoría que da el ícono a un producto: la suya si tiene ícono o imagen; si no,
 * la madre (una subcategoría hereda el de su principal). Undefined si ninguna tiene.
 */
export function categoriaConIcono(
  categorias: Pick<Categoria, "id" | "padre_id" | "icono" | "imagen_path">[],
  categoriaId: string | null | undefined,
) {
  const propia = categoriaId ? categorias.find((c) => c.id === categoriaId) : undefined;
  if (!propia) return undefined;
  if (propia.icono || propia.imagen_path) return propia;
  const madre = propia.padre_id ? categorias.find((c) => c.id === propia.padre_id) : undefined;
  return madre && (madre.icono || madre.imagen_path) ? madre : undefined;
}
