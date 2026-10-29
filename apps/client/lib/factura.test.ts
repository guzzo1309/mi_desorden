import { describe, expect, it } from "bun:test";
import { filasDeBloques, juntarLineas, leerFactura, lineaDeFila, problemaLineas } from "./factura";

describe("filasDeBloques", () => {
  it("junta las columnas de la misma fila y las ordena de izquierda a derecha", () => {
    const filas = filasDeBloques([
      { texto: "3,50", x: 0.8, y: 0.301, ancho: 0.1, alto: 0.02 },
      { texto: "Harina PAN", x: 0.1, y: 0.3, ancho: 0.4, alto: 0.02 },
      { texto: "2", x: 0.6, y: 0.299, ancho: 0.05, alto: 0.02 },
      { texto: "Arroz Mary", x: 0.1, y: 0.35, ancho: 0.4, alto: 0.02 },
      { texto: "1", x: 0.6, y: 0.352, ancho: 0.05, alto: 0.02 },
    ]);
    expect(filas).toEqual(["Harina PAN  2  3,50", "Arroz Mary  1"]);
  });

  it("sin texto no devuelve filas", () => {
    expect(filasDeBloques([{ texto: "  ", x: 0, y: 0, ancho: 1, alto: 0.1 }])).toEqual([]);
  });
});

describe("lineaDeFila", () => {
  it("cantidad al principio", () => {
    expect(lineaDeFila("2 x Harina PAN 1kg   3,50")).toEqual({
      nombre: "Harina PAN 1kg",
      cantidad: 2,
    });
    expect(lineaDeFila("12  Coca Cola 1.5L  1,75  21,00")).toEqual({
      nombre: "Coca Cola 1.5L",
      cantidad: 12,
    });
  });

  it("cantidad después del nombre", () => {
    expect(lineaDeFila("Harina PAN 1kg  2  1,75  3,50")).toEqual({
      nombre: "Harina PAN 1kg",
      cantidad: 2,
    });
    expect(lineaDeFila("Tornillos 3/8  25 und  $ 0.10")).toEqual({
      nombre: "Tornillos 3/8",
      cantidad: 25,
    });
  });

  it("cantidad pegada al nombre", () => {
    expect(lineaDeFila("Jabón Las Llaves x3")).toEqual({ nombre: "Jabón Las Llaves", cantidad: 3 });
  });

  it("sin cantidad pero con precio es una unidad", () => {
    expect(lineaDeFila("Caja de clavos  Bs.120,00")).toEqual({
      nombre: "Caja de clavos",
      cantidad: 1,
    });
  });

  it("descarta encabezados, totales y datos fiscales", () => {
    for (const fila of [
      "CANT  DESCRIPCIÓN  PRECIO  TOTAL",
      "SUBTOTAL  45,00",
      "IVA 16%  7,20",
      "Bs. 52,20  TOTAL",
      "RIF: J-12345678-9",
      "Fecha: 26/10/2026",
      "Gracias por su compra",
      "0001234",
    ]) {
      expect(lineaDeFila(fila)).toBeNull();
    }
  });

  it("descarta texto suelto sin cantidad ni precio", () => {
    expect(lineaDeFila("Bodegón La Esquina")).toBeNull();
  });
});

describe("juntarLineas", () => {
  it("suma el mismo producto aunque cambien las mayúsculas o los espacios", () => {
    expect(
      juntarLineas([
        { nombre: "Harina PAN", cantidad: 2 },
        { nombre: "harina  pan", cantidad: 3 },
        { nombre: "Arroz", cantidad: 1 },
      ]),
    ).toEqual([
      { nombre: "Harina PAN", cantidad: 5 },
      { nombre: "Arroz", cantidad: 1 },
    ]);
  });
});

describe("leerFactura", () => {
  it("de las filas de una factura a los productos", () => {
    expect(
      leerFactura([
        "Bodegón La Esquina",
        "RIF: J-12345678-9",
        "CANT  DESCRIPCIÓN  PRECIO",
        "2  Harina PAN 1kg  3,50",
        "1  Arroz Mary 1kg  2,00",
        "1  Harina PAN 1kg  1,75",
        "TOTAL  7,25",
      ]),
    ).toEqual([
      { nombre: "Harina PAN 1kg", cantidad: 3 },
      { nombre: "Arroz Mary 1kg", cantidad: 1 },
    ]);
  });
});

describe("lineaDeFila sin columnas", () => {
  it("respeta los números del nombre", () => {
    expect(lineaDeFila("3 Harina 500 g 2,10")).toEqual({ nombre: "Harina 500 g", cantidad: 3 });
  });
});

describe("problemaLineas", () => {
  it("deja cargar varias líneas válidas, aunque se repitan", () => {
    expect(
      problemaLineas([
        { nombre: "Harina", cantidad: 2 },
        { nombre: "harina", cantidad: 1 },
        { nombre: "Arroz", cantidad: 12 },
      ]),
    ).toBeNull();
  });

  it("avisa lo que está mal", () => {
    expect(problemaLineas([])).toContain("por lo menos");
    expect(problemaLineas([{ nombre: "  ", cantidad: 1 }])).toContain("sin nombre");
    expect(problemaLineas([{ nombre: "Arroz", cantidad: 0 }])).toContain("1 a");
    expect(
      problemaLineas(Array.from({ length: 201 }, (_, i) => ({ nombre: `P${i}`, cantidad: 1 }))),
    ).toContain("Máximo");
  });
});

/**
 * La factura de Staples (tabla Cantidad | Descripción | Precio | Importe), como la lee
 * Vision palabra por palabra. Antes salían "Alabarán nº 3800" y "Presupuesto nº 800" como
 * productos y casi todas las cantidades en 1 (la columna de la izquierda no se asociaba).
 */
describe("factura con tabla (Cantidad | Descripción | Precio | Importe)", () => {
  const ALTO = 0.012;
  const ANCHO_LETRA = 0.0085;
  const ESPACIO = 0.006;

  /** Una fila: cada columna es [x donde empieza, texto]; las palabras de una columna van pegadas. */
  function fila(y: number, columnas: [number, string][]) {
    const bloques: { texto: string; x: number; y: number; ancho: number; alto: number }[] = [];
    for (const [x0, texto] of columnas) {
      let x = x0;
      for (const palabra of texto.split(" ")) {
        const ancho = palabra.length * ANCHO_LETRA;
        bloques.push({ texto: palabra, x, y, ancho, alto: ALTO });
        x += ancho + ESPACIO;
      }
    }
    return bloques;
  }

  const productos: [string, string, string, string][] = [
    ["5", "Grapadora", "3,99", "19,95"],
    ["3", "Taladro", "4,95", "14,85"],
    ["20", "A-Z", "0,89", "17,8"],
    ["1", "Juego de 30 separadores", "1,09", "1,09"],
    ["1", "1 Juego de 100 fundas", "2,00", "2,00"],
    ["5", "Calculadoras", "9,95", "49,75"],
    ["3", "Memoria USB de 8 GB", "18,95", "56,85"],
    ["4", "Cuaderno Oxford", "1,39", "5,56"],
    ["15", "Carpetas de cartón", "0,15", "2,25"],
    ["1", "Pack de 4 bandejas opacas", "6,99", "6,99"],
  ];

  const bloques = [
    ...fila(0.1, [[0.15, "EMPRESA"]]),
    ...fila(0.2, [
      [0.45, "Fecha fra.:"],
      [0.62, "10/02/2012"],
    ]),
    ...fila(0.22, [[0.45, "Referencias:"]]),
    ...fila(0.24, [
      [0.45, "Alabarán nº:"],
      [0.7, "3800"],
    ]),
    ...fila(0.26, [
      [0.45, "Pedido nº:"],
      [0.62, "03/02/2012"],
    ]),
    ...fila(0.28, [
      [0.45, "Presupuesto nº:"],
      [0.7, "800"],
    ]),
    ...fila(0.3, [
      [0.12, "Cantidad"],
      [0.35, "Descripcion"],
      [0.55, "Precio"],
      [0.68, "Importe"],
    ]),
    ...productos.flatMap(([q, d, p, i], n) =>
      fila(0.33 + n * 0.022, [
        [0.17, q],
        [0.21, d],
        [0.56, p],
        [0.7, i],
      ]),
    ),
    ...fila(0.6, [[0.2, "DESCUENTO"]]),
    ...fila(0.62, [
      [0.25, "BASE IMPONIBLE"],
      [0.7, "177,09"],
    ]),
    ...fila(0.64, [
      [0.35, "IVA"],
      [0.5, "18%"],
      [0.7, "31,88"],
    ]),
    ...fila(0.68, [
      [0.3, "TOTAL FACTURA"],
      [0.7, "208,97"],
    ]),
  ];

  it("lee cada producto con la cantidad de su columna y deja afuera los datos de arriba y los totales", () => {
    expect(leerFactura(filasDeBloques(bloques))).toEqual([
      { nombre: "Grapadora", cantidad: 5 },
      { nombre: "Taladro", cantidad: 3 },
      { nombre: "A-Z", cantidad: 20 },
      { nombre: "Juego de 30 separadores", cantidad: 1 },
      { nombre: "1 Juego de 100 fundas", cantidad: 1 },
      { nombre: "Calculadoras", cantidad: 5 },
      { nombre: "Memoria USB de 8 GB", cantidad: 3 },
      { nombre: "Cuaderno Oxford", cantidad: 4 },
      { nombre: "Carpetas de cartón", cantidad: 15 },
      { nombre: "Pack de 4 bandejas opacas", cantidad: 1 },
    ]);
  });

  it("las palabras de una misma columna quedan juntas y las columnas separadas", () => {
    const filas = filasDeBloques(
      fila(0.4, [
        [0.17, "5"],
        [0.21, "Memoria USB de 8 GB"],
        [0.56, "3,99"],
      ]),
    );
    expect(filas).toEqual(["5  Memoria USB de 8 GB  3,99"]);
  });
});
