import { strFromU8, unzipSync } from "fflate";

/**
 * Lector mínimo de recibos digitales: .xlsx (y .csv) → filas de celdas.
 *
 * Un .xlsx es un zip con XML adentro. Para sacar productos y cantidades
 * alcanza con la primera hoja y los textos compartidos, así que se lee a mano
 * con fflate (JS puro, anda igual en el teléfono y en web) en vez de sumar una
 * librería pesada. Fórmulas: se usa el último valor calculado que guardó Excel.
 */

export type Celda = string | number;

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function desescapar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

/** Todo el texto de los <t> de un pedazo de XML (los textos con formato vienen partidos). */
function textos(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => desescapar(m[1]!))
    .join("");
}

/** "AB12" → 27 (base 0). */
function columna(ref: string): number {
  const letras = ref.match(/^[A-Z]+/i)?.[0].toUpperCase() ?? "A";
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

/** Ruta de la primera hoja del libro (workbook.xml + sus relaciones), con respaldo a sheet1. */
function rutaPrimeraHoja(archivos: Record<string, Uint8Array>): string {
  const respaldo = "xl/worksheets/sheet1.xml";
  const libro = archivos["xl/workbook.xml"];
  const rels = archivos["xl/_rels/workbook.xml.rels"];
  if (!libro || !rels) return respaldo;
  const id = strFromU8(libro).match(/<sheet\b[^>]*\br:id="([^"]+)"/)?.[1];
  if (!id) return respaldo;
  const rel = [...strFromU8(rels).matchAll(/<Relationship\b[^>]*>/g)]
    .map((m) => m[0])
    .find((r) => r.includes(`Id="${id}"`));
  const destino = rel?.match(/Target="([^"]+)"/)?.[1];
  if (!destino) return respaldo;
  return destino.startsWith("/") ? destino.slice(1) : `xl/${destino.replace(/^\.\//, "")}`;
}

/** Primera hoja de un .xlsx como filas de celdas (las vacías quedan como ""). */
export function leerXlsx(bytes: Uint8Array): Celda[][] {
  let archivos: Record<string, Uint8Array>;
  try {
    archivos = unzipSync(bytes);
  } catch {
    throw new Error("El archivo no es un Excel válido (.xlsx).");
  }
  const hoja = archivos[rutaPrimeraHoja(archivos)];
  if (!hoja) throw new Error("El Excel no tiene hojas.");

  const compartidos = archivos["xl/sharedStrings.xml"]
    ? [...strFromU8(archivos["xl/sharedStrings.xml"]).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
        textos(m[1]!),
      )
    : [];

  const filas: Celda[][] = [];
  for (const fila of strFromU8(hoja).matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const celdas: Celda[] = [];
    for (const c of (fila[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const contenido = c[2] ?? "";
      const ref = attrs.match(/\br="([A-Z]+\d+)"/i)?.[1];
      const tipo = attrs.match(/\bt="(\w+)"/)?.[1];
      const v = contenido.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let valor: Celda = "";
      if (tipo === "s" && v !== undefined) valor = compartidos[Number(v)] ?? "";
      else if (tipo === "inlineStr") valor = textos(contenido);
      else if (tipo === "str" || tipo === "e") valor = desescapar(v ?? "");
      else if (tipo === "b") valor = v === "1" ? "VERDADERO" : "FALSO";
      else if (v !== undefined && v !== "") valor = Number(v);
      const i = ref ? columna(ref) : celdas.length;
      while (celdas.length < i) celdas.push("");
      celdas[i] = valor;
    }
    filas.push(celdas);
  }
  return filas;
}

/** .csv con coma, punto y coma o tab (el que más aparezca en el encabezado). Respeta comillas. */
export function leerCsv(texto: string): Celda[][] {
  const limpio = texto.replace(/^\uFEFF/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const separador = [";", ",", "\t"].reduce((a, b) =>
    primera.split(b).length > primera.split(a).length ? b : a,
  );

  const filas: Celda[][] = [];
  let fila: string[] = [];
  let celda = "";
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const ch = limpio[i]!;
    if (comillas) {
      if (ch === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (ch === '"') {
        comillas = false;
      } else {
        celda += ch;
      }
    } else if (ch === '"') {
      comillas = true;
    } else if (ch === separador) {
      fila.push(celda);
      celda = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else {
      celda += ch;
    }
  }
  if (celda || fila.length) filas.push([...fila, celda]);
  return filas.filter((f) => f.some((c) => String(c).trim()));
}
