import { describe, expect, test } from "bun:test";
import { esPorReponer, faltante, porReponer, textoAvisoStock } from "./stock";

const p = (nombre: string, cantidad: number, minimo: number) => ({ nombre, cantidad, minimo });

describe("esPorReponer", () => {
  test("solo por debajo del mínimo", () => {
    expect(esPorReponer(p("a", 1, 2))).toBe(true);
    expect(esPorReponer(p("a", 2, 2))).toBe(false);
    expect(esPorReponer(p("a", 0, 0))).toBe(false);
  });
});

describe("faltante", () => {
  test("nunca negativo", () => {
    expect(faltante(p("a", 1, 5))).toBe(4);
    expect(faltante(p("a", 9, 5))).toBe(0);
  });
});

describe("porReponer", () => {
  test("agotados primero, después el que más falta, después por nombre", () => {
    const lista = porReponer([
      p("Zeta", 1, 3), // falta 2
      p("Beta", 0, 2), // agotado, falta 2
      p("Alfa", 1, 3), // falta 2
      p("Gama", 0, 5), // agotado, falta 5
      p("Ok", 10, 3), // no hace falta
    ]);
    expect(lista.map((x) => x.nombre)).toEqual(["Gama", "Beta", "Alfa", "Zeta"]);
  });
  test("no modifica la lista original", () => {
    const original = [p("b", 0, 1), p("a", 5, 1)];
    porReponer(original);
    expect(original.map((x) => x.nombre)).toEqual(["b", "a"]);
  });
});

describe("textoAvisoStock", () => {
  test("singular y plural", () => {
    expect(textoAvisoStock(1, 0)).toBe("1 producto por reponer");
    expect(textoAvisoStock(3, 1)).toBe("3 productos por reponer · 1 agotado");
    expect(textoAvisoStock(4, 2)).toBe("4 productos por reponer · 2 agotados");
  });
});
