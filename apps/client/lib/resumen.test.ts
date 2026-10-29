import { describe, expect, test } from "bun:test";
import {
  coincideChip,
  contarResumen,
  esAgotado,
  nivelSalud,
  pocasFotos,
  porcentaje,
  sinCategoria,
  textoAgotados,
} from "./resumen";

const p = (o: Partial<Parameters<typeof contarResumen>[0][0]> = {}) => ({
  cantidad: 5,
  minimo: 1,
  categoria_id: "c1" as string | null,
  foto_path: "a" as string | null,
  fotos_extra: ["b"],
  ...o,
});

describe("predicados", () => {
  test("agotado", () => {
    expect(esAgotado({ cantidad: 0 })).toBe(true);
    expect(esAgotado({ cantidad: 1 })).toBe(false);
  });
  test("pocas fotos: menos de 2", () => {
    expect(pocasFotos({ foto_path: null, fotos_extra: [] })).toBe(true);
    expect(pocasFotos({ foto_path: "a", fotos_extra: [] })).toBe(true);
    expect(pocasFotos({ foto_path: "a", fotos_extra: ["b"] })).toBe(false);
    expect(pocasFotos({ foto_path: "a", fotos_extra: ["b", "c"] })).toBe(false);
  });
  test("sin categoría", () => {
    expect(sinCategoria({ categoria_id: null })).toBe(true);
    expect(sinCategoria({ categoria_id: "x" })).toBe(false);
  });
  test("chips", () => {
    expect(coincideChip(p({ fotos_extra: [] }), "pocasFotos")).toBe(true);
    expect(coincideChip(p(), "pocasFotos")).toBe(false);
    expect(coincideChip(p({ categoria_id: null }), "sinCategoria")).toBe(true);
  });
});

describe("contarResumen", () => {
  test("cuenta cada cosa por separado", () => {
    const r = contarResumen([
      p({ cantidad: 0, minimo: 2 }), // agotado y por reponer
      p({ cantidad: 1, minimo: 3, fotos_extra: [] }), // por reponer, pocas fotos
      p({ cantidad: 10, categoria_id: null }), // sin categoría
      p({ cantidad: 0, minimo: 0 }), // agotado pero sin mínimo: no cuenta como por reponer
    ]);
    expect(r).toEqual({
      total: 4,
      pctEnRegla: 50,
      pctCamaraLista: 75,
      unidades: 11,
      reponer: 2,
      agotados: 2,
      pocasFotos: 1,
      sinCategoria: 1,
    });
  });
  test("vacío", () => {
    expect(contarResumen([])).toEqual({
      total: 0,
      pctEnRegla: 100,
      pctCamaraLista: 100,
      unidades: 0,
      reponer: 0,
      agotados: 0,
      pocasFotos: 0,
      sinCategoria: 0,
    });
  });
});

describe("textoAgotados", () => {
  test("singular, plural y nada", () => {
    expect(textoAgotados(0)).toBe("");
    expect(textoAgotados(1)).toBe("1 agotado");
    expect(textoAgotados(4)).toBe("4 agotados");
  });
});

describe("porcentaje y nivel", () => {
  test("porcentaje redondeado y sin total", () => {
    expect(porcentaje(11, 12)).toBe(92);
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(0, 0)).toBe(100);
  });
  test("nivelSalud", () => {
    const u = { bien: 90, medio: 70 };
    expect(nivelSalud(100, u)).toBe("bien");
    expect(nivelSalud(90, u)).toBe("bien");
    expect(nivelSalud(89, u)).toBe("medio");
    expect(nivelSalud(70, u)).toBe("medio");
    expect(nivelSalud(69, u)).toBe("mal");
  });
});
