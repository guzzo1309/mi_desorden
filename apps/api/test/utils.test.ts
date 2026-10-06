import { describe, expect, it } from "bun:test";
import { ahoraIso, crearFiltroOrigen, ipDe, normalizarOrigen, paginar } from "../src/utils";

describe("utils", () => {
  it("paginar devuelve items y total", () => {
    expect(paginar(["a", "b"])).toEqual({ items: ["a", "b"], total: 2 });
    expect(paginar([])).toEqual({ items: [], total: 0 });
  });

  it("ahoraIso da una fecha ISO de ahora", () => {
    const iso = ahoraIso();
    expect(new Date(iso).toISOString()).toBe(iso);
    expect(Math.abs(Date.now() - Date.parse(iso))).toBeLessThan(1000);
  });

  it("ipDe prefiere req.ip y cae al socket", () => {
    expect(ipDe({ ip: "1.2.3.4", socket: { remoteAddress: "9.9.9.9" } } as never)).toBe("1.2.3.4");
    expect(ipDe({ ip: undefined, socket: { remoteAddress: "9.9.9.9" } } as never)).toBe("9.9.9.9");
    expect(ipDe({ ip: undefined, socket: {} } as never)).toBe("desconocida");
  });

  it("normalizarOrigen deja solo esquema + host", () => {
    expect(normalizarOrigen("mi-desorden.vercel.app")).toBe("https://mi-desorden.vercel.app");
    expect(normalizarOrigen("http://localhost:8081/")).toBe("http://localhost:8081");
    expect(() => normalizarOrigen("https://a.com/path")).toThrow();
  });

  it("crearFiltroOrigen compara el origen exacto", () => {
    const ok = crearFiltroOrigen(["https://a.com"]);
    expect(ok(undefined)).toBe(true);
    expect(ok("https://a.com")).toBe(true);
    expect(ok("https://a.com.evil.com")).toBe(false);
    expect(ok("http://a.com")).toBe(false);
    expect(ok("basura")).toBe(false);
    expect(crearFiltroOrigen(["*"])("https://lo-que-sea.com")).toBe(true);
  });
});
