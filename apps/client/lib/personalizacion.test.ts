import { describe, expect, it } from "bun:test";
import {
  COLORES_TITULO,
  FUENTES_TITULO,
  estiloTituloCatalogo,
  normalizarColor,
  normalizarFuente,
} from "./personalizacion";

describe("personalización de catálogos", () => {
  it("ofrece varias fuentes y varios colores", () => {
    expect(FUENTES_TITULO.length).toBeGreaterThanOrEqual(4);
    expect(COLORES_TITULO.length).toBeGreaterThanOrEqual(6);
  });

  it("normalizarFuente solo acepta 1 fuente válida a la vez", () => {
    expect(normalizarFuente("serif")).toBe("serif");
    expect(normalizarFuente(" redondeada ")).toBe("redondeada");
    expect(normalizarFuente("serif,monoespaciada")).toBeNull();
    expect(normalizarFuente("comic-sans")).toBeNull();
    expect(normalizarFuente(null)).toBeNull();
  });

  it("normalizarColor solo acepta 1 color hex válido a la vez", () => {
    expect(normalizarColor("#c46a14")).toBe("#C46A14");
    expect(normalizarColor(" #007AFF ")).toBe("#007AFF");
    expect(normalizarColor("#007AFF,#FF3B30")).toBeNull();
    expect(normalizarColor("rojo")).toBeNull();
    expect(normalizarColor(null)).toBeNull();
  });

  it("estiloTituloCatalogo aplica el color y la fuente o vuelve al tema", () => {
    expect(estiloTituloCatalogo(null, "#2A1D10")).toEqual({ color: "#2A1D10" });
    const estilo = estiloTituloCatalogo(
      { fuente_titulo: "serif", color_titulo: "#007aff" },
      "#2A1D10",
    );
    expect(estilo.color).toBe("#007AFF");
    expect(estilo.fontFamily).toBeTruthy();
  });
});
