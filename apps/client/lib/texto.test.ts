import { describe, expect, test } from "bun:test";
import { esReciente, nombreLugar } from "./texto";

describe("nombreLugar", () => {
  test("baja las mayúsculas sostenidas", () => {
    expect(nombreLugar("ESCRITORIO")).toBe("Escritorio");
    expect(nombreLugar("ESCRITORIO 2")).toBe("Escritorio 2");
    expect(nombreLugar("ESTANTE ÚNICO")).toBe("Estante único");
  });
  test("respeta lo que ya trae minúsculas", () => {
    expect(nombreLugar("Depósito B")).toBe("Depósito B");
    expect(nombreLugar("mesa")).toBe("mesa");
  });
  test("sin letras o vacío, igual", () => {
    expect(nombreLugar("  ")).toBe("");
    expect(nombreLugar("A1")).toBe("A1");
    expect(nombreLugar("12")).toBe("12");
  });
});

describe("esReciente", () => {
  const ahora = new Date("2026-11-11T12:00:00Z").getTime();
  test("menos de un día", () => {
    expect(esReciente("2026-11-11T09:00:00Z", ahora)).toBe(true);
  });
  test("más de un día", () => {
    expect(esReciente("2026-10-29T12:00:00Z", ahora)).toBe(false);
  });
});
