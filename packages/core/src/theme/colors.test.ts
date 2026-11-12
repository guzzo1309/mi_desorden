import { describe, expect, it } from "bun:test";
import { darkTheme, lightTheme, palette } from "./colors";

describe("palette", () => {
  it("contiene los tokens esenciales de la nueva identidad", () => {
    expect(palette.primary[700]).toBe("#1D4ED8");
    expect(palette.accent[600]).toBe("#D97706");
    expect(palette.live[600]).toBe("#0D9488");
    expect(palette.neutral[950]).toBe("#0F1115");
  });

  it("lightTheme y darkTheme tienen la estructura de tokens esperada", () => {
    expect(lightTheme.primary).toBe(palette.primary[700]);
    expect(darkTheme.primary).toBe(palette.primary[500]);
    expect(lightTheme.accent).toBe(palette.accent[600]);
    expect(darkTheme.accent).toBe(palette.accent[400]);
    expect(lightTheme.live).toBe(palette.live[600]);
    expect(darkTheme.live).toBe(palette.live[600]);
  });
});
