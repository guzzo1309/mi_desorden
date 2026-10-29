import { describe, expect, test } from "bun:test";
import { fechaCorta, iniciales, inicioDeHoy } from "./fecha";

describe("fechaCorta", () => {
  test("incluye día, mes y año", () => {
    const f = fechaCorta("2026-10-29T12:00:00Z");
    expect(f).toContain("2026");
    expect(f).toContain("29");
  });
});

describe("iniciales", () => {
  test("dos palabras", () => {
    expect(iniciales("Diego Guzzo")).toBe("DG");
  });
  test("una palabra", () => {
    expect(iniciales("Admin")).toBe("A");
  });
});

describe("inicioDeHoy", () => {
  test("es la medianoche local del mismo día", () => {
    const ahora = new Date(2026, 9, 29, 15, 30);
    const inicio = new Date(inicioDeHoy(ahora));
    expect(inicio.getFullYear()).toBe(2026);
    expect(inicio.getMonth()).toBe(9);
    expect(inicio.getDate()).toBe(29);
    expect(inicio.getHours()).toBe(0);
    expect(inicio.getMinutes()).toBe(0);
  });
});
