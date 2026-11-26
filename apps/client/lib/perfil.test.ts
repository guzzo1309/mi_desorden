import { describe, expect, test } from "bun:test";
import {
  errorNombre,
  errorTelefono,
  limpiarNombre,
  limpiarTelefono,
  numeroWhatsApp,
} from "./perfil";

describe("nombre", () => {
  test("quita espacios de más", () => {
    expect(limpiarNombre("  Ana   María ")).toBe("Ana María");
  });
  test("pide al menos 2 letras y como mucho 60", () => {
    expect(errorNombre(" a ")).not.toBeNull();
    expect(errorNombre("Al")).toBeNull();
    expect(errorNombre("x".repeat(61))).not.toBeNull();
  });
});

describe("teléfono", () => {
  test("vacío es válido y se guarda como null", () => {
    expect(limpiarTelefono("   ")).toBeNull();
    expect(errorTelefono("")).toBeNull();
  });
  test("acepta formatos comunes", () => {
    expect(errorTelefono("+58 412 555-1234")).toBeNull();
    expect(errorTelefono("(0212) 555 1234")).toBeNull();
    expect(errorTelefono("04125551234")).toBeNull();
  });
  test("rechaza letras, muy corto o muy largo", () => {
    expect(errorTelefono("0412-abc-1234")).not.toBeNull();
    expect(errorTelefono("12345")).not.toBeNull();
    expect(errorTelefono("+58 412 555 1234 5678 99")).not.toBeNull();
    expect(errorTelefono("58+4125551234")).not.toBeNull();
  });
});

describe("numeroWhatsApp", () => {
  test("número local venezolano", () => {
    expect(numeroWhatsApp("0412 548 4775")).toBe("584125484775");
  });
  test("internacional con + o con 00", () => {
    expect(numeroWhatsApp("+58 (412) 548-4775")).toBe("584125484775");
    expect(numeroWhatsApp("0034 600 123 456")).toBe("34600123456");
  });
  test("sin 0 ni +: se deja como está", () => {
    expect(numeroWhatsApp("584125484775")).toBe("584125484775");
  });
  test("muy corto o vacío", () => {
    expect(numeroWhatsApp("123")).toBeNull();
    expect(numeroWhatsApp("")).toBeNull();
  });
});
