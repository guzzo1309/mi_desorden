

export type Fuente = "normal" | "negrita";
export type Alineacion = "izquierda" | "derecha" | "centro";

export const A4 = { ancho: 595.28, alto: 841.89 } as const;

// Anchos de Helvetica y Helvetica-Bold (AFM de Adobe), del carácter 32 al 126.
// prettier-ignore
const ANCHOS_NORMAL = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
// prettier-ignore
const ANCHOS_NEGRITA = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Caracteres de WinAnsi que no están en el mismo lugar que en Unicode. */
const WIN_ANSI: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
  "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91,
  "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98,
  "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

const ANCHOS_ESPECIALES: Record<string, number> = {
  "€": 556, "…": 1000, "–": 556, "—": 1000, "“": 333, "”": 333, "‘": 222, "’": 222,
  "•": 350, "·": 278, "¿": 611, "¡": 333, "«": 556, "»": 556, "°": 400, "º": 365,
  "ª": 370, "\u00a0": 278,
};

function codigoWinAnsi(c: string): number | null {
  const especial = WIN_ANSI[c];
  if (especial !== undefined) return especial;
  const n = c.codePointAt(0)!;
  if (n >= 32 && n <= 126) return n;
  if (n >= 0xa0 && n <= 0xff) return n;
  return null;
}

/** El texto con caracteres que existen en WinAnsi (sin tilde o "?" si no hay forma). */
export function aWinAnsi(texto: string): string {
  let salida = "";
  for (const c of texto.replace(/[\t\r\n]+/g, " ")) {
    if (codigoWinAnsi(c) !== null) {
      salida += c;
      continue;
    }
    const base = c.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    salida += base && [...base].every((b) => codigoWinAnsi(b) !== null) ? base : "?";
  }
  return salida;
}

function anchoCaracter(c: string, fuente: Fuente): number {
  const tabla = fuente === "negrita" ? ANCHOS_NEGRITA : ANCHOS_NORMAL;
  const n = c.codePointAt(0)!;
  if (n >= 32 && n <= 126) return tabla[n - 32]!;
  const especial = ANCHOS_ESPECIALES[c];
  if (especial !== undefined) return especial;
  const b = c.normalize("NFD")[0]!.codePointAt(0)!;
  if (b >= 32 && b <= 126) return tabla[b - 32]!;
  return 556;
}

export function anchoTexto(texto: string, tam: number, fuente: Fuente = "normal"): number {
  let milesimas = 0;
  for (const c of aWinAnsi(texto)) milesimas += anchoCaracter(c, fuente);
  return (milesimas * tam) / 1000;
}

/** Corta el texto con "…" para que entre en `ancho` puntos. */
export function recortar(
  texto: string,
  ancho: number,
  tam: number,
  fuente: Fuente = "normal",
): string {
  const limpio = aWinAnsi(texto);
  if (anchoTexto(limpio, tam, fuente) <= ancho) return limpio;
  const puntos = anchoTexto("…", tam, fuente);
  let corte = "";
  for (const c of limpio) {
    if (anchoTexto(corte + c, tam, fuente) + puntos > ancho) break;
    corte += c;
  }
  return `${corte.trimEnd()}…`;
}

/** Parte un texto en líneas que entren en `ancho` puntos. */
export function partirLineas(
  texto: string,
  ancho: number,
  tam: number,
  fuente: Fuente = "normal",
): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of aWinAnsi(texto).split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (!actual || anchoTexto(prueba, tam, fuente) <= ancho) {
      actual = prueba;
    } else {
      lineas.push(actual);
      actual = palabra;
    }
  }
  if (actual) lineas.push(actual);
  return lineas.map((l) =>
    anchoTexto(l, tam, fuente) > ancho ? recortar(l, ancho, tam, fuente) : l,
  );
}

function rgb(hex: string): string {
  const h = hex.replace("#", "");
  const completo = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  if (!/^[0-9a-f]{6}$/i.test(completo)) throw new Error(`Color inválido: ${hex}`);
  const n = Number.parseInt(completo, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => num(v / 255)).join(" ");
}

function num(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

/** String literal de PDF: \ ( ) escapados y bytes altos en octal. */
function literal(texto: string): string {
  let salida = "(";
  for (const c of texto) {
    const codigo = codigoWinAnsi(c) ?? 63;
    if (c === "\\" || c === "(" || c === ")") salida += `\\${c}`;
    else if (codigo < 128) salida += c;
    else salida += `\\${codigo.toString(8).padStart(3, "0")}`;
  }
  return `${salida})`;
}

function hexUtf16(texto: string): string {
  let hex = "FEFF";
  for (let i = 0; i < texto.length; i++) {
    hex += texto.charCodeAt(i).toString(16).padStart(4, "0").toUpperCase();
  }
  return `<${hex}>`;
}

export interface OpcionesTexto {
  tam?: number;
  fuente?: Fuente;
  color?: string;
  alinear?: Alineacion;
}

export class DocumentoPdf {
  readonly ancho: number = A4.ancho;
  readonly alto: number = A4.alto;
  private paginas: string[][] = [];
  private actual = -1;

  constructor() {
    this.nuevaPagina();
  }

  get totalPaginas(): number {
    return this.paginas.length;
  }

  nuevaPagina(): void {
    this.paginas.push([]);
    this.actual = this.paginas.length - 1;
  }

  irAPagina(indice: number): void {
    if (indice < 0 || indice >= this.paginas.length) throw new Error("Esa página no existe");
    this.actual = indice;
  }

  texto(x: number, y: number, texto: string, o: OpcionesTexto = {}): void {
    const tam = o.tam ?? 10;
    const fuente = o.fuente ?? "normal";
    const limpio = aWinAnsi(texto);
    if (!limpio) return;
    const ancho = anchoTexto(limpio, tam, fuente);
    const xReal = o.alinear === "derecha" ? x - ancho : o.alinear === "centro" ? x - ancho / 2 : x;
    this.paginas[this.actual]!.push(
      `BT ${rgb(o.color ?? "#000000")} rg /${fuente === "negrita" ? "F2" : "F1"} ${num(tam)} Tf ` +
        `${num(xReal)} ${num(this.alto - y)} Td ${literal(limpio)} Tj ET`,
    );
  }

  rect(x: number, y: number, ancho: number, alto: number, color: string): void {
    this.paginas[this.actual]!.push(
      `${rgb(color)} rg ${num(x)} ${num(this.alto - y - alto)} ${num(ancho)} ${num(alto)} re f`,
    );
  }

  linea(x1: number, y1: number, x2: number, y2: number, color: string, grosor = 0.5): void {
    this.paginas[this.actual]!.push(
      `${rgb(color)} RG ${num(grosor)} w ${num(x1)} ${num(this.alto - y1)} m ` +
        `${num(x2)} ${num(this.alto - y2)} l S`,
    );
  }

  generar(info: { titulo?: string; autor?: string } = {}): Uint8Array {
    const objetos: string[] = [];
    const total = this.paginas.length;
    const idPagina = (i: number) => 6 + i * 2;
    const idContenido = (i: number) => 7 + i * 2;

    objetos[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    objetos[2] = `<< /Type /Pages /Count ${total} /Kids [${this.paginas.map((_, i) => `${idPagina(i)} 0 R`).join(" ")}] >>`;
    objetos[3] =
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objetos[4] =
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
    const partesInfo = ["/Producer (MI DESORDEN)"];
    if (info.titulo) partesInfo.push(`/Title ${hexUtf16(info.titulo)}`);
    if (info.autor) partesInfo.push(`/Author ${hexUtf16(info.autor)}`);
    objetos[5] = `<< ${partesInfo.join(" ")} >>`;

    this.paginas.forEach((ops, i) => {
      objetos[idPagina(i)] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.ancho)} ${num(this.alto)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${idContenido(i)} 0 R >>`;
      const flujo = ops.join("\n");
      objetos[idContenido(i)] = `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`;
    });

    let salida = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    const posiciones: number[] = [];
    for (let id = 1; id < objetos.length; id++) {
      posiciones[id] = salida.length;
      salida += `${id} 0 obj\n${objetos[id]}\nendobj\n`;
    }
    const inicioXref = salida.length;
    salida += `xref\n0 ${objetos.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objetos.length; id++) {
      salida += `${String(posiciones[id]).padStart(10, "0")} 00000 n \n`;
    }
    salida +=
      `trailer\n<< /Size ${objetos.length} /Root 1 0 R /Info 5 0 R >>\n` +
      `startxref\n${inicioXref}\n%%EOF\n`;

    const bytes = new Uint8Array(salida.length);
    for (let i = 0; i < salida.length; i++) bytes[i] = salida.charCodeAt(i) & 0xff;
    return bytes;
  }
}