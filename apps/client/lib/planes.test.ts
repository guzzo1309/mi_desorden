import { describe, expect, test } from "bun:test";
import {
  leerLimite,
  nivelCupo,
  textoCerca,
  resumenLimites,
  textoLimite,
  textoPrecio,
} from "./planes";

describe("leerLimite", () => {
  test("vacío es ilimitado", () => {
    expect(leerLimite("")).toBeNull();
    expect(leerLimite("   ")).toBeNull();
  });
  test("número entero positivo", () => {
    expect(leerLimite("5")).toBe(5);
    expect(leerLimite(" 100 ")).toBe(100);
  });
  test("inválido", () => {
    expect(leerLimite("0")).toBeUndefined();
    expect(leerLimite("-1")).toBeUndefined();
    expect(leerLimite("2.5")).toBeUndefined();
    expect(leerLimite("diez")).toBeUndefined();
  });
});

describe("textos", () => {
  test("límite", () => {
    expect(textoLimite(null)).toBe("Sin límite");
    expect(textoLimite(2)).toBe("2");
  });
  test("precio", () => {
    expect(textoPrecio(null)).toBe("—");
    expect(textoPrecio(0)).toBe("Gratis");
    expect(textoPrecio(9.99)).toContain("/ mes");
  });
  test("resumen de límites", () => {
    expect(resumenLimites({ max_inventarios: 1, max_productos: 100, max_personas: 2 })).toBe(
      "1 inventario · 100 productos · 2 personas",
    );
    expect(resumenLimites({ max_inventarios: null, max_productos: null, max_personas: null })).toBe(
      "inventarios sin límite · productos sin límite · personas sin límite",
    );
  });
});

describe("nivelCupo", () => {
  test("sin límite siempre libre", () => {
    expect(nivelCupo(10_000, null)).toBe("libre");
  });
  test("libre, cerca (80 %) y lleno", () => {
    expect(nivelCupo(10, 100)).toBe("libre");
    expect(nivelCupo(79, 100)).toBe("libre");
    expect(nivelCupo(80, 100)).toBe("cerca");
    expect(nivelCupo(99, 100)).toBe("cerca");
    expect(nivelCupo(100, 100)).toBe("lleno");
    expect(nivelCupo(120, 100)).toBe("lleno");
  });
  test("límite chico", () => {
    expect(nivelCupo(1, 2)).toBe("libre");
    expect(nivelCupo(2, 2)).toBe("lleno");
  });
});

describe("textoCerca", () => {
  test("inventarios no nombra un inventario", () => {
    expect(textoCerca({ recurso: "inventarios", inventario: null, usados: 1, max: 1 })).toBe(
      "1 de 1 inventarios",
    );
  });
  test("productos nombra el inventario", () => {
    expect(textoCerca({ recurso: "productos", inventario: "Depósito", usados: 90, max: 100 })).toBe(
      "90 de 100 productos en “Depósito”",
    );
  });
});
