import { describe, expect, test } from "bun:test";
import {
  categoriaConIcono,
  colorDe,
  COLORES,
  esColorLibre,
  estaPersonalizada,
  FUENTES,
  hslAHex,
  normalizarHex,
} from "./estiloCategoria";
import type { Tema } from "./theme";

const tema = {
  texto: "#texto",
  tinte: "#tinte",
  kraft: "#kraft",
  rojo: "#rojo",
  verde: "#verde",
  azul: "#azul",
  violeta: "#violeta",
} as unknown as Tema;

describe("estilo de categoría", () => {
  test("sin color usa el del texto; marca usa el tinte", () => {
    expect(colorDe(null, tema)).toBe("#texto");
    expect(colorDe("marca", tema)).toBe("#tinte");
    expect(colorDe("azul", tema)).toBe("#azul");
  });

  test("todos los colores de la paleta existen en el tema", () => {
    for (const { valor } of COLORES) expect(colorDe(valor, tema)).toStartWith("#");
  });

  test("sin fuente queda la del sistema", () => {
    expect(FUENTES[0]!.valor).toBeNull();
  });

  test("detecta si hay algo personalizado", () => {
    expect(estaPersonalizada({ imagen_path: null, fuente: null, color: null })).toBe(false);
    expect(estaPersonalizada({ imagen_path: null, fuente: "serif", color: null })).toBe(true);
  });
});

describe("color libre", () => {
  test("un #RRGGBB se usa tal cual; uno mal formado cae al del texto", () => {
    expect(colorDe("#12AB9F", tema)).toBe("#12AB9F");
    expect(colorDe("#xyz" as `#${string}`, tema)).toBe("#texto");
    expect(esColorLibre("azul")).toBe(false);
  });

  test("HSL a hex", () => {
    expect(hslAHex(0, 100, 50)).toBe("#FF0000");
    expect(hslAHex(120, 100, 50)).toBe("#00FF00");
    expect(hslAHex(240, 100, 50)).toBe("#0000FF");
    expect(hslAHex(0, 0, 100)).toBe("#FFFFFF");
  });

  test("normaliza lo que se escribe", () => {
    expect(normalizarHex("ff8800")).toBe("#FF8800");
    expect(normalizarHex(" #f80 ")).toBe("#FF8800");
    expect(normalizarHex("#12345")).toBeNull();
    expect(normalizarHex("naranja")).toBeNull();
  });
});

describe("íconos de categoría", () => {
  test("claves únicas, con el formato que acepta la base", async () => {
    const { GRUPOS_ICONOS, iconoPorClave } = await import("./iconosCategoria");
    const claves = GRUPOS_ICONOS.flatMap((g) => g.iconos.map((i) => i.clave));
    expect(new Set(claves).size).toBe(claves.length);
    for (const c of claves) expect(c).toMatch(/^[a-z_]{2,30}$/);
    expect(iconoPorClave("caja")?.sf).toBe("shippingbox.fill");
    expect(iconoPorClave("no_existe")).toBeUndefined();
    expect(iconoPorClave(null)).toBeUndefined();
  });
});

describe("ícono de la categoría de un producto", () => {
  const cats = [
    { id: "a", padre_id: null, icono: "caja", imagen_path: null },
    { id: "a1", padre_id: "a", icono: null, imagen_path: null },
    { id: "a2", padre_id: "a", icono: "bebidas", imagen_path: null },
    { id: "b", padre_id: null, icono: null, imagen_path: null },
  ];
  test("la propia, la de la madre o ninguna", () => {
    expect(categoriaConIcono(cats, "a2")?.id).toBe("a2");
    expect(categoriaConIcono(cats, "a1")?.id).toBe("a");
    expect(categoriaConIcono(cats, "b")).toBeUndefined();
    expect(categoriaConIcono(cats, null)).toBeUndefined();
  });
});
