import { describe, expect, test } from "bun:test";
import { fechaCorta, iniciales } from "./fecha";

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
