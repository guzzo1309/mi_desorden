import { describe, expect, test } from "bun:test";
import { lugaresLibres, MAX_FOTOS, rutasDe, sinFoto, textoFotos } from "./fotos";

describe("rutasDe", () => {
  test("principal primero y sin huecos", () => {
    expect(rutasDe({ foto_path: "a", fotos_extra: ["b", "c"] })).toEqual(["a", "b", "c"]);
    expect(rutasDe({ foto_path: null, fotos_extra: [] })).toEqual([]);
    expect(rutasDe({ foto_path: "a", fotos_extra: [] })).toEqual(["a"]);
  });
});

describe("cupo", () => {
  test("máximo 3", () => {
    expect(MAX_FOTOS).toBe(3);
    expect(lugaresLibres(1)).toBe(2);
    expect(lugaresLibres(3)).toBe(0);
    expect(lugaresLibres(5)).toBe(0);
    expect(textoFotos(2)).toBe("2 de 3 fotos");
  });
});

describe("sinFoto", () => {
  test("quitar una extra", () => {
    expect(sinFoto({ foto_path: "a", fotos_extra: ["b", "c"] }, "b")).toEqual({
      foto_path: "a",
      fotos_extra: ["c"],
    });
  });
  test("quitar la principal sube la primera extra", () => {
    expect(sinFoto({ foto_path: "a", fotos_extra: ["b", "c"] }, "a")).toEqual({
      foto_path: "b",
      fotos_extra: ["c"],
    });
  });
  test("quitar la única", () => {
    expect(sinFoto({ foto_path: "a", fotos_extra: [] }, "a")).toEqual({
      foto_path: null,
      fotos_extra: [],
    });
  });
});
