import type { LineaFactura } from "@mi-desorden/core";

/**
 * Lectura de facturas: del texto que reconoce el teléfono a las líneas
 * { nombre, cantidad } que se cargan al inventario. Funciones puras, sin
 * React ni backend, para poder probarlas.
 */

/** Un pedazo de texto que reconoció Vision, con su caja (0 a 1, origen arriba a la izquierda). */
export interface BloqueTexto {
  texto: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
}

/**
 * Vision devuelve cada columna de la factura como un bloque aparte. Se agrupan
 * los que están a la misma altura (una fila de la factura) y se ordenan de
 * izquierda a derecha. Las columnas se separan con dos espacios.
 */
export function filasDeBloques(bloques: BloqueTexto[]): string[] {
  const conTexto = bloques.filter((b) => b.texto.trim());
  if (!conTexto.length) return [];
  const altos = conTexto.map((b) => b.alto).sort((a, b) => a - b);
  const altoTipico = altos[Math.floor(altos.length / 2)]!;
  const centro = (b: BloqueTexto) => b.y + b.alto / 2;

  const filas: BloqueTexto[][] = [];
  for (const b of [...conTexto].sort((a, b) => centro(a) - centro(b))) {
    const fila = filas.at(-1);
    if (fila && Math.abs(centro(fila[0]!) - centro(b)) < altoTipico * 0.6) fila.push(b);
    else filas.push([b]);
  }
  return filas.map((f) =>
    f
      .sort((a, b) => a.x - b.x)
      .map((b) => b.texto.trim())
      .join("  "),
  );
}

/**
 * Filas que no son productos: encabezados, totales, datos fiscales, pagos.
 * Se mira el comienzo de la fila para no descartar productos como "Caja de clavos".
 */
const NO_ES_PRODUCTO =
  /^\W*(sub\s*total|total|iva|igv|impuestos?|base imponible|exento|descuentos?|factura|fecha|hora|rif|nif|cif|cliente|raz[oó]n social|direcci[oó]n|tel[eé]fono|tlf|cajer[oa]|vendedor|efectivo|pago|vuelto|cambio|gracias|n[uú]mero de control|nro\.?|serie|cant\.?|cantidad|descripci[oó]n|c[oó]digo|precio|importe|monto)\b/i;
/** Totales e impuestos aunque no estén al principio ("Bs. 120,00  TOTAL"). */
const TOTALES = /\b(sub\s*total|total|iva|igv)\b/i;

/** "3,50", "1.250,00", "$ 12.99", "Bs.120,00": un precio, no una cantidad. */
const ES_PRECIO =
  /^(?:bs\.?|\$|€|usd|eur)?\s*\d{1,3}(?:[.,]\d{3})*[.,]\d{1,2}$|^(?:bs\.?|\$|€)\s*\d+$/i;
/** Una cantidad entera: "2", "x2", "2x", "2 u", "12und". */
const ES_CANTIDAD = /^(?:x\s*)?(\d{1,4})(?:\s*(?:x|u|un|und|uds?|unid|pzas?|piezas?))?$/i;

const MAX_CANTIDAD = 9999;

function cantidadDe(token: string): number | null {
  const m = token.trim().match(ES_CANTIDAD);
  if (!m) return null;
  const n = Number(m[1]);
  return n > 0 && n <= MAX_CANTIDAD ? n : null;
}

function limpiarNombre(nombre: string): string {
  return nombre
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–•*.:#]+|[\s\-–•*.:#]+$/g, "")
    .slice(0, 120);
}

/** Por lo menos dos letras seguidas: descarta filas que son solo números o códigos. */
const tieneNombre = (s: string) => /\p{L}{2,}/u.test(s);

/**
 * Una fila de la factura → línea, o null si no es un producto.
 *
 * Formatos que entiende:
 * - cantidad primero:  "2 x Harina PAN 1kg   3,50"  ·  "2  Harina PAN  1,75  3,50"
 * - cantidad después:  "Harina PAN 1kg   2   1,75   3,50"  ·  "Harina PAN x2"
 * - sin cantidad:      "Harina PAN 1kg   3,50"  → 1 unidad
 */
export function lineaDeFila(fila: string): LineaFactura | null {
  const texto = fila.trim();
  if (!texto || NO_ES_PRODUCTO.test(texto) || TOTALES.test(texto)) return null;

  // Columnas separadas por dos o más espacios o tabs; si no hay, por espacios.
  const columnas = texto.split(/\s{2,}|\t/).filter(Boolean);
  const partes = columnas.length > 1 ? columnas : texto.split(/\s+/);

  // Precios afuera: no aportan al inventario.
  const sinPrecios = partes.filter((p) => !ES_PRECIO.test(p.trim()));

  // "2 x Harina PAN" en una sola columna: la cantidad pasa a su propia columna.
  const inicio = sinPrecios[0]?.match(/^(\d{1,4}\s*(?:x|u|und|uds?)?)\s+(.*\p{L}.*)$/iu);
  if (inicio && columnas.length > 1) sinPrecios.splice(0, 1, inicio[1]!, inicio[2]!);

  // 1) Cantidad al principio.
  const primera = cantidadDe(sinPrecios[0] ?? "");
  if (primera !== null && sinPrecios.length > 1) {
    const nombre = limpiarNombre(sinPrecios.slice(1).join(" ").replace(/^x\s+/i, ""));
    if (tieneNombre(nombre)) return { nombre, cantidad: primera };
  }

  // 2) Cantidad después del nombre: la primera columna que sea una cantidad.
  const i = sinPrecios.findIndex((p, j) => j > 0 && cantidadDe(p) !== null);
  if (i > 0) {
    const nombre = limpiarNombre(sinPrecios.slice(0, i).join(" "));
    if (tieneNombre(nombre)) return { nombre, cantidad: cantidadDe(sinPrecios[i]!)! };
  }

  // 3) "Harina PAN x2" dentro de una sola columna.
  const pegada = texto.match(/^(.*?\p{L}.*?)\s+x\s*(\d{1,4})\b/iu);
  if (pegada) {
    const nombre = limpiarNombre(pegada[1]!);
    const cantidad = Number(pegada[2]);
    if (tieneNombre(nombre) && cantidad > 0) return { nombre, cantidad };
  }

  // 4) Sin cantidad: si tenía precio, es un producto suelto (1 unidad).
  const tienePrecio = partes.some((p) => ES_PRECIO.test(p.trim()));
  const nombre = limpiarNombre(sinPrecios.join(" "));
  if (tienePrecio && tieneNombre(nombre)) return { nombre, cantidad: 1 };
  return null;
}

/** Junta las líneas del mismo producto (sin importar mayúsculas ni espacios). */
export function juntarLineas(lineas: LineaFactura[]): LineaFactura[] {
  const porNombre = new Map<string, LineaFactura>();
  for (const l of lineas) {
    const clave = l.nombre.trim().toLowerCase().replace(/\s+/g, " ");
    const ya = porNombre.get(clave);
    if (ya) ya.cantidad = Math.min(ya.cantidad + l.cantidad, MAX_CANTIDAD);
    else porNombre.set(clave, { nombre: l.nombre.trim(), cantidad: l.cantidad });
  }
  return [...porNombre.values()];
}

/** Todo junto: filas de texto de la factura → productos para cargar. */
export function leerFactura(filas: string[]): LineaFactura[] {
  return juntarLineas(filas.map(lineaDeFila).filter((l): l is LineaFactura => l !== null));
}

/** Encabezados de columna que se reconocen en un recibo digital (Excel o CSV). */
const COL_NOMBRE =
  /^(producto|productos|descripci[oó]n|nombre|art[ií]culo|item|[ií]tem|detalle|concepto)\b/i;
const COL_CANTIDAD = /^(cant\.?|cantidad|cantidades|unidades|uds?\.?|qty|quantity)\b/i;

/**
 * Filas de una tabla (Excel o CSV) → productos.
 *
 * Si hay una fila de encabezado con columnas de producto y cantidad (en las
 * primeras 15), se usan esas columnas. Si no, cada fila se lee como una fila
 * de factura con lineaDeFila.
 */
export function lineasDeTabla(filas: (string | number)[][]): LineaFactura[] {
  const texto = (c: string | number | undefined) => String(c ?? "").trim();
  const iEncabezado = filas
    .slice(0, 15)
    .findIndex(
      (f) => f.some((c) => COL_NOMBRE.test(texto(c))) && f.some((c) => COL_CANTIDAD.test(texto(c))),
    );

  if (iEncabezado >= 0) {
    const encabezado = filas[iEncabezado]!.map(texto);
    const colNombre = encabezado.findIndex((c) => COL_NOMBRE.test(c));
    const colCantidad = encabezado.findIndex((c) => COL_CANTIDAD.test(c));
    const lineas: LineaFactura[] = [];
    for (const f of filas.slice(iEncabezado + 1)) {
      const nombre = limpiarNombre(texto(f[colNombre]));
      if (!tieneNombre(nombre) || TOTALES.test(nombre)) continue;
      const crudo = f[colCantidad];
      // En Excel la cantidad suele venir como número; en CSV, como texto ("3" o "3,0").
      const cantidad = typeof crudo === "number" ? crudo : Number(texto(crudo).replace(",", "."));
      if (Number.isInteger(cantidad) && cantidad > 0 && cantidad <= MAX_CANTIDAD) {
        lineas.push({ nombre, cantidad });
      }
    }
    return juntarLineas(lineas);
  }

  return leerFactura(filas.map((f) => f.map(texto).filter(Boolean).join("  ")));
}

/** Tope de productos por factura (igual que cargar_productos en la base). */
export const MAX_LINEAS = 200;

/**
 * Antes de cargar: qué está mal en las líneas que revisó el usuario, o null
 * si se pueden cargar. Las repetidas no son error: se juntan al cargar.
 */
export function problemaLineas(lineas: LineaFactura[]): string | null {
  if (!lineas.length) return "Agregá por lo menos un producto.";
  if (lineas.length > MAX_LINEAS) return `Máximo ${MAX_LINEAS} productos por factura.`;
  if (lineas.some((l) => !l.nombre.trim())) return "Hay un producto sin nombre.";
  if (lineas.some((l) => l.nombre.trim().length > 120)) return "Hay un nombre muy largo.";
  if (
    lineas.some((l) => !Number.isInteger(l.cantidad) || l.cantidad < 1 || l.cantidad > MAX_CANTIDAD)
  ) {
    return `Las cantidades van de 1 a ${MAX_CANTIDAD}.`;
  }
  return null;
}
