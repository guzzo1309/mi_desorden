import { describe, expect, test } from "bun:test";
import {
  convieneReemplazar,
  ESCALONES_OPTIMIZAR,
  lugaresLibres,
  MAX_FOTOS,
  ofrecerFotoDeCamara,
  rutasDe,
  rutasPesadas,
  sinFoto,
  textoFotos,
} from "./fotos";

describe("rutasDe", () => {
  test("principal primero y sin huecos", () => {
    expect(rutasDe({ foto_path: "a", fotos_extra: ["b", "c"] })).toEqual(["a", "b", "c"]);
    expect(rutasDe({ foto_path: null, fotos_extra: [] })).toEqual([]);
    expect(rutasDe({ foto_path: "a", fotos_extra: [] })).toEqual(["a"]);
  });
});

describe("cupo", () => {
  test("máximo 6", () => {
    expect(MAX_FOTOS).toBe(6);
    expect(lugaresLibres(1)).toBe(5);
    expect(lugaresLibres(6)).toBe(0);
    expect(lugaresLibres(8)).toBe(0);
    expect(textoFotos(1)).toBe("1 foto");
    expect(textoFotos(2)).toBe("2 fotos");
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

describe("ofrecerFotoDeCamara", () => {
  const una = { foto_path: "a", fotos_extra: [] as string[] };
  const dos = { foto_path: "a", fotos_extra: ["b"] };
  const tres = { foto_path: "a", fotos_extra: ["b", "c"] };
  test("sin permiso de fotos nunca", () => {
    expect(ofrecerFotoDeCamara(una, { corregido: true, puedeFotos: false })).toBe(false);
  });
  test("con pocas fotos se ofrece aunque no haya corrección", () => {
    expect(ofrecerFotoDeCamara(una, { corregido: false, puedeFotos: true })).toBe(true);
    expect(
      ofrecerFotoDeCamara(
        { foto_path: null, fotos_extra: [] },
        { corregido: false, puedeFotos: true },
      ),
    ).toBe(true);
  });
  test("con 2 fotos solo si fue una corrección", () => {
    expect(ofrecerFotoDeCamara(dos, { corregido: false, puedeFotos: true })).toBe(false);
    expect(ofrecerFotoDeCamara(dos, { corregido: true, puedeFotos: true })).toBe(true);
  });
  test("con 3 fotos ya no se ofrece (aunque quepan más)", () => {
    expect(ofrecerFotoDeCamara(tres, { corregido: true, puedeFotos: true })).toBe(false);
  });
});

describe("rutasPesadas", () => {
  const archivos = [
    { name: "a.jpg", metadata: { size: 2_500_000 } },
    { name: "b.jpg", metadata: { size: 90_000 } },
    { name: "c.jpeg", metadata: { size: 4_000_000 } },
    { name: "d.png", metadata: { size: 9_000_000 } },
    { name: "e.jpg", metadata: null },
    { name: "f.jpg" },
  ];
  test("solo jpg que pesan más del mínimo, la más pesada primero", () => {
    expect(rutasPesadas(archivos, "inv")).toEqual(["inv/c.jpeg", "inv/a.jpg"]);
  });
  test("mínimo propio", () => {
    expect(rutasPesadas(archivos, "inv", 50_000)).toEqual(["inv/c.jpeg", "inv/a.jpg", "inv/b.jpg"]);
  });
  test("vacío", () => {
    expect(rutasPesadas([], "inv")).toEqual([]);
  });
});

describe("optimizar", () => {
  test("los escalones van de más calidad a menos peso", () => {
    const [primero] = ESCALONES_OPTIMIZAR;
    expect(primero).toEqual({ ancho: 900, calidad: 0.6 });
    for (let i = 1; i < ESCALONES_OPTIMIZAR.length; i++) {
      const a = ESCALONES_OPTIMIZAR[i - 1]!;
      const b = ESCALONES_OPTIMIZAR[i]!;
      expect(b.ancho <= a.ancho && b.calidad <= a.calidad).toBe(true);
      expect(b.ancho < a.ancho || b.calidad < a.calidad).toBe(true);
    }
  });

  test("solo reemplaza si la nueva pesa de verdad menos", () => {
    // El caso del bug: re-comprimir una foto ya achicada da el mismo peso.
    expect(convieneReemplazar(331_000, 331_000)).toBe(false);
    expect(convieneReemplazar(331_000, 320_000)).toBe(false);
    expect(convieneReemplazar(331_000, 240_000)).toBe(true);
    expect(convieneReemplazar(2_000_000, 110_000)).toBe(true);
  });
});
