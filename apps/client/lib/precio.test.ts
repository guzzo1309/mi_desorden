import { describe, expect, test } from "bun:test";
import { conMoneda, formatoPrecio, leerPrecio, margen, textoMargen } from "./precio";

describe("leerPrecio", () => {
  test("vacío es null (opcional)", () => {
    expect(leerPrecio("  ")).toBeNull();
  });
  test("acepta coma o punto decimal", () => {
    expect(leerPrecio("12,5")).toBe(12.5);
    expect(leerPrecio("12.50")).toBe(12.5);
    expect(leerPrecio("1500")).toBe(1500);
  });
  test("rechaza letras, negativos, miles y más de 2 decimales", () => {
    for (const x of ["abc", "-3", "1.234,56", "1,234", "1.999"]) {
      expect(leerPrecio(x)).toBe("invalido");
    }
  });
});

describe("formatoPrecio", () => {
  test("coma decimal y punto de miles", () => {
    expect(formatoPrecio(1234.5)).toBe("1.234,50");
    expect(formatoPrecio(1234.5, false)).toBe("1234,50");
    expect(formatoPrecio(0)).toBe("0,00");
  });
  test("lo que se formatea sin miles se vuelve a leer igual", () => {
    expect(leerPrecio(formatoPrecio(987.65, false))).toBe(987.65);
  });
});

describe("margen", () => {
  test("ganancia y porcentaje", () => {
    expect(margen(10, 15)).toEqual({ ganancia: 5, porcentaje: 50 });
    expect(margen(0, 15)).toEqual({ ganancia: 15, porcentaje: null });
    expect(margen(10, null)).toBeNull();
  });
});

test("conMoneda pone el símbolo del inventario", () => {
  expect(conMoneda(1234.5, "USD")).toBe("$1.234,50");
  expect(conMoneda(12, "EUR")).toBe("€12,00");
  expect(conMoneda(-3, undefined)).toBe("-$3,00");
});

test("textoMargen arma la ganancia o la pérdida", () => {
  expect(textoMargen(10, 17.5, "USD")).toBe("Ganancia por unidad: $7,50 (75 %).");
  expect(textoMargen(10, 8, "EUR")).toBe("Pérdida por unidad: €2,00 (-20 %).");
  expect(textoMargen(0, 5, "USD")).toBe("Ganancia por unidad: $5,00.");
  expect(textoMargen(null, 5, "USD")).toBeNull();
});
