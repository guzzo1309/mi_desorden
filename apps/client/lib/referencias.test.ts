import { describe, expect, test } from "bun:test";
import { aplanarHuellas, mejorDistancia } from "./referencias";

describe("aplanarHuellas", () => {
  test("una referencia por foto", () => {
    expect(aplanarHuellas({ p1: ["a", "b"], p2: ["c"] })).toEqual({
      "p1#0": "a",
      "p1#1": "b",
      "p2#0": "c",
    });
  });
  test("vacío", () => {
    expect(aplanarHuellas({})).toEqual({});
  });
});

describe("mejorDistancia", () => {
  test("se queda con la foto más parecida de cada producto", () => {
    expect(mejorDistancia({ "p1#0": 0.9, "p1#1": 0.4, "p2#0": 0.7 })).toEqual({
      p1: 0.4,
      p2: 0.7,
    });
  });
  test("acepta claves sin #", () => {
    expect(mejorDistancia({ p1: 0.5 })).toEqual({ p1: 0.5 });
  });
  test("ids con # adentro no se rompen", () => {
    expect(mejorDistancia({ "a#b#0": 0.3, "a#b#1": 0.2 })).toEqual({ "a#b": 0.2 });
  });
});
