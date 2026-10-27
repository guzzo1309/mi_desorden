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
