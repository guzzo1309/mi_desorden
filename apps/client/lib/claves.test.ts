import { describe, expect, test } from "bun:test";
import { generarClave, textoCredenciales } from "./claves";

describe("generarClave", () => {
  test("largo y mínimo de 8", () => {
    expect(generarClave(10)).toHaveLength(10);
    expect(generarClave(3)).toHaveLength(8);
  });
  test("solo caracteres sin ambigüedad", () => {
    for (let i = 0; i < 50; i++) expect(generarClave(12)).toMatch(/^[a-hjkmnp-zA-HJ-NP-Z2-9]+$/);
  });
  test("no repite siempre la misma", () => {
    const set = new Set(Array.from({ length: 20 }, () => generarClave()));
    expect(set.size).toBeGreaterThan(15);
  });
});

describe("textoCredenciales", () => {
  test("incluye correo y contraseña", () => {
    const t = textoCredenciales({
      nombre: "Ana",
      email: "ana@x.com",
      clave: "Abc12345",
      inventarios: ["Depósito"],
    });
    expect(t).toContain("ana@x.com");
    expect(t).toContain("Abc12345");
    expect(t).toContain("«Depósito»");
  });
  test("varios inventarios", () => {
    const t = textoCredenciales({
      nombre: "Ana",
      email: "a@x.com",
      clave: "x",
      inventarios: ["A", "B"],
    });
    expect(t).toContain("«A», «B»");
  });
});
