import { describe, expect, test } from "bun:test";
import { claveCumple, faltantesClave, textoFaltantes } from "./clave";

describe("clave", () => {
  test("acepta 8 caracteres con mayúscula y carácter especial", () => {
    expect(claveCumple("Inventar!o")).toBe(true);
    expect(claveCumple("Ñandú#2026")).toBe(true);
  });

  test("rechaza la del ejemplo viejo de 6 caracteres", () => {
    expect(claveCumple("abc123")).toBe(false);
  });

  test("dice qué falta, en orden", () => {
    expect(faltantesClave("")).toEqual(["8 caracteres", "una mayúscula", "un carácter especial"]);
    expect(faltantesClave("abcdefgh")).toEqual(["una mayúscula", "un carácter especial"]);
    expect(faltantesClave("Abcdefgh")).toEqual(["un carácter especial"]);
    expect(faltantesClave("Ab#")).toEqual(["8 caracteres"]);
  });

  test("un espacio no cuenta como carácter especial", () => {
    expect(claveCumple("Abcd efgh")).toBe(false);
  });

  test("arma el texto para la pantalla", () => {
    expect(textoFaltantes("abcdefgh")).toBe("Necesita una mayúscula y un carácter especial.");
    expect(textoFaltantes("Abcdefgh")).toBe("Necesita un carácter especial.");
    expect(textoFaltantes("Abcdefg#")).toBe("");
  });
});
