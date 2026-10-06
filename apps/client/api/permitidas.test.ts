/// <reference types="bun" />
import { describe, expect, it } from "bun:test";
import { ambienteDe, API_STAGING, resolverApiUrl } from "./permitidas";

describe("ambienteDe", () => {
  it("entiende los nombres de Doppler", () => {
    expect(ambienteDe("stg")).toBe("staging");
    expect(ambienteDe("prd")).toBe("production");
    expect(ambienteDe(undefined)).toBe("development");
  });
});

describe("lista blanca de la API", () => {
  it("en stg usa la API de Vercel por defecto", () => {
    expect(resolverApiUrl("staging", undefined)).toBe(API_STAGING);
  });

  it("en stg acepta solo la API de Vercel en /api/v1", () => {
    expect(resolverApiUrl("staging", "https://mi-desorden.vercel.app/api/v1/")).toBe(API_STAGING);
    expect(
      resolverApiUrl("staging", "https://mi-desorden-guzzo1309s-projects.vercel.app/api/v1"),
    ).toBe("https://mi-desorden-guzzo1309s-projects.vercel.app/api/v1");
  });

  it.each([
    ["http (sin TLS)", "http://mi-desorden.vercel.app/api/v1"],
    ["otro dominio", "https://otra-api.vercel.app/api/v1"],
    ["subdominio parecido", "https://mi-desorden.vercel.app.evil.com/api/v1"],
    ["preview de una rama", "https://mi-desorden-git-algo-guzzo1309s-projects.vercel.app/api/v1"],
    ["otro path", "https://mi-desorden.vercel.app/otra"],
    ["con credenciales", "https://user:pass@mi-desorden.vercel.app/api/v1"],
    ["localhost", "http://localhost:3000/api/v1"],
    ["basura", "no es una url"],
  ])("en stg rechaza %s", (_, url) => {
    expect(() => resolverApiUrl("staging", url)).toThrow();
  });

  it("en desarrollo acepta localhost y la IP de la red", () => {
    expect(resolverApiUrl("development", undefined)).toBe("http://localhost:3000/api/v1");
    expect(resolverApiUrl("development", "http://192.168.1.50:3000/api/v1")).toBe(
      "http://192.168.1.50:3000/api/v1",
    );
  });

  it("en desarrollo no deja apuntar a una API pública", () => {
    expect(() => resolverApiUrl("development", API_STAGING)).toThrow();
  });

  it("en producción no hay ninguna permitida todavía", () => {
    expect(() => resolverApiUrl("production", API_STAGING)).toThrow();
  });
});
