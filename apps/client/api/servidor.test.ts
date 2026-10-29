import { ApiError } from "@mi-desorden/core";
import { describe, expect, it } from "bun:test";
import { servidorNoDisponible } from "./errores";

describe("servidorNoDisponible", () => {
  it("sin red o con la API caída: se invita por la base", () => {
    expect(servidorNoDisponible(new TypeError("Network request failed"))).toBe(true);
    expect(servidorNoDisponible(new ApiError("x", 500))).toBe(true);
    expect(servidorNoDisponible(new ApiError("x", 503))).toBe(true);
  });
  it("errores del usuario se muestran tal cual", () => {
    expect(servidorNoDisponible(new ApiError("x", 403))).toBe(false);
    expect(servidorNoDisponible(new ApiError("x", 409))).toBe(false);
  });
});
