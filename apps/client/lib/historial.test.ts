import { describe, expect, test } from "bun:test";
import type { Movimiento } from "@mi-desorden/core";
import { agruparPorDia, etiquetaDia, quienHizo, textoMovimiento } from "./historial";

const base: Movimiento = {
  id: 1,
  producto_id: "p1",
  producto_nombre: "Coca Cola",
  usuario_id: "u1",
  usuario: { nombre: "Ana" },
  tipo: "stock",
  cantidad_antes: 10,
  cantidad_despues: 8,
  fuente: "manual",
  detalle: {},
  creado_en: "2026-10-29T15:00:00",
};

describe("quienHizo", () => {
  test("vos, nombre o alguien", () => {
    expect(quienHizo(base, "u1")).toBe("Vos");
    expect(quienHizo(base, "otro")).toBe("Ana");
    expect(quienHizo({ usuario_id: null, usuario: null })).toBe("Alguien");
  });
});

describe("textoMovimiento", () => {
  test("stock", () => {
    expect(textoMovimiento(base, "otro")).toEqual({
      titulo: "Ana ajustó «Coca Cola»",
      detalle: "10 → 8",
    });
  });
  test("stock con la cámara", () => {
    expect(textoMovimiento({ ...base, fuente: "camara" }).detalle).toBe("10 → 8 · con la cámara");
  });
  test("creado", () => {
    const t = textoMovimiento({
      ...base,
      tipo: "creado",
      cantidad_antes: null,
      cantidad_despues: 1,
    });
    expect(t.titulo).toBe("Ana agregó «Coca Cola»");
    expect(t.detalle).toBe("1 unidad");
  });
  test("editado lista los campos", () => {
    const t = textoMovimiento({
      ...base,
      tipo: "editado",
      detalle: { ubicacion: { de: "A2", a: "B3" }, categoria: { de: null, a: "Bebidas" } },
    });
    expect(t.detalle).toBe("ubicación: A2 → B3 · categoría: — → Bebidas");
  });
  test("eliminado", () => {
    const t = textoMovimiento({ ...base, tipo: "eliminado", cantidad_antes: 4 });
    expect(t.titulo).toBe("Ana eliminó «Coca Cola»");
    expect(t.detalle).toBe("Tenía 4 unidades");
  });
});

describe("días", () => {
  const ahora = new Date("2026-10-29T18:00:00");
  test("hoy y ayer", () => {
    expect(etiquetaDia("2026-10-29T01:00:00", ahora)).toBe("Hoy");
    expect(etiquetaDia("2026-10-28T23:00:00", ahora)).toBe("Ayer");
  });
  test("agrupa renglones seguidos del mismo día", () => {
    const g = agruparPorDia(
      [
        { ...base, id: 3, creado_en: "2026-10-29T17:00:00" },
        { ...base, id: 2, creado_en: "2026-10-29T09:00:00" },
        { ...base, id: 1, creado_en: "2026-10-28T09:00:00" },
      ],
      ahora,
    );
    expect(g.map((x) => [x.dia, x.items.length])).toEqual([
      ["Hoy", 2],
      ["Ayer", 1],
    ]);
  });
});
