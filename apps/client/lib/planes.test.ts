import { describe, expect, test } from "bun:test";
import {
  estadoPedido,
  agruparCerca,
  ahorroAnual,
  dinero,
  mayorAhorro,
  partesPrecio,
  precioDe,
  leerLimite,
  nivelCupo,
  textoCerca,
  resumenLimites,
  textoLimite,
  textoPrecio,
} from "./planes";

describe("leerLimite", () => {
  test("vacío es ilimitado", () => {
    expect(leerLimite("")).toBeNull();
    expect(leerLimite("   ")).toBeNull();
  });
  test("número entero positivo", () => {
    expect(leerLimite("5")).toBe(5);
    expect(leerLimite(" 100 ")).toBe(100);
  });
  test("inválido", () => {
    expect(leerLimite("0")).toBeUndefined();
    expect(leerLimite("-1")).toBeUndefined();
    expect(leerLimite("2.5")).toBeUndefined();
    expect(leerLimite("diez")).toBeUndefined();
  });
});

describe("textos", () => {
  test("límite", () => {
    expect(textoLimite(null)).toBe("Sin límite");
    expect(textoLimite(2)).toBe("2");
  });
  test("precio", () => {
    expect(textoPrecio(null)).toBe("—");
    expect(textoPrecio(0)).toBe("Gratis");
    expect(textoPrecio(9.99)).toContain("/ mes");
  });
  test("resumen de límites", () => {
    expect(resumenLimites({ max_inventarios: 1, max_productos: 100, max_personas: 2 })).toBe(
      "1 inventario · 100 productos · 2 personas",
    );
    expect(resumenLimites({ max_inventarios: null, max_productos: null, max_personas: null })).toBe(
      "inventarios sin límite · productos sin límite · personas sin límite",
    );
    expect(
      resumenLimites({
        max_inventarios: 1,
        max_categorias: 10,
        max_productos: 100,
        max_personas: 2,
      }),
    ).toBe("1 inventario · 10 categorías · 100 productos · 2 personas");
    expect(
      resumenLimites({
        max_inventarios: 1,
        max_categorias: null,
        max_productos: 1,
        max_personas: 1,
      }),
    ).toBe("1 inventario · categorías sin límite · 1 producto · 1 persona");
  });
});

describe("nivelCupo", () => {
  test("sin límite siempre libre", () => {
    expect(nivelCupo(10_000, null)).toBe("libre");
  });
  test("libre, cerca (80 %) y lleno", () => {
    expect(nivelCupo(10, 100)).toBe("libre");
    expect(nivelCupo(79, 100)).toBe("libre");
    expect(nivelCupo(80, 100)).toBe("cerca");
    expect(nivelCupo(99, 100)).toBe("cerca");
    expect(nivelCupo(100, 100)).toBe("lleno");
    expect(nivelCupo(120, 100)).toBe("lleno");
  });
  test("límite chico", () => {
    expect(nivelCupo(1, 2)).toBe("libre");
    expect(nivelCupo(2, 2)).toBe("lleno");
  });
});

describe("textoCerca", () => {
  test("inventarios no nombra un inventario", () => {
    expect(textoCerca({ recurso: "inventarios", inventario: null, usados: 1, max: 1 })).toBe(
      "1 de 1 inventarios",
    );
  });
  test("productos nombra el inventario", () => {
    expect(textoCerca({ recurso: "productos", inventario: "Depósito", usados: 90, max: 100 })).toBe(
      "90 de 100 productos en “Depósito”",
    );
  });
  test("categorías lleva tilde", () => {
    expect(textoCerca({ recurso: "categorias", inventario: "Tienda", usados: 9, max: 10 })).toBe(
      "9 de 10 categorías en “Tienda”",
    );
  });
});

describe("estadoPedido", () => {
  test("texto y color de cada estado", () => {
    expect(estadoPedido("aprobado")).toEqual({ texto: "Aprobado", color: "verde" });
    expect(estadoPedido("rechazado")).toEqual({ texto: "Rechazado", color: "rojo" });
    expect(estadoPedido("cancelado").color).toBe("gris");
  });
});

describe("precios anuales", () => {
  test("dinero sin decimales si es entero", () => {
    expect(dinero(48)).toBe("$48");
    expect(dinero(4.8)).toBe("$4,80");
  });
  test("precio del período, con el anual de respaldo en 12 meses", () => {
    expect(precioDe({ precio_mensual: 5, precio_anual: 48 }, "anual")).toBe(48);
    expect(precioDe({ precio_mensual: 5, precio_anual: undefined }, "anual")).toBe(60);
    expect(precioDe({ precio_mensual: 5, precio_anual: 48 }, "mensual")).toBe(5);
    expect(precioDe({ precio_mensual: null, precio_anual: null }, "anual")).toBeNull();
  });
  test("ahorro del anual", () => {
    expect(ahorroAnual({ precio_mensual: 5, precio_anual: 48 })).toBe(20);
    expect(ahorroAnual({ precio_mensual: 0, precio_anual: 0 })).toBeNull();
    expect(ahorroAnual({ precio_mensual: 5, precio_anual: 60 })).toBeNull();
    expect(
      mayorAhorro([
        { precio_mensual: 5, precio_anual: 48 },
        { precio_mensual: 20, precio_anual: 180 },
      ]),
    ).toBe(25);
  });
  test("partes del precio anual", () => {
    expect(partesPrecio(48, "anual")).toEqual({ monto: "$48", periodo: "/ año" });
  });
});

describe("partesPrecio", () => {
  test("monto grande y período aparte", () => {
    expect(partesPrecio(5)).toEqual({ monto: "$5", periodo: "/ mes" });
    expect(partesPrecio(0)).toEqual({ monto: "Gratis", periodo: null });
    expect(partesPrecio(null)).toEqual({ monto: "—", periodo: null });
  });
});

describe("agruparCerca", () => {
  test("una fila por cuenta, las más llenas primero", () => {
    const base = { email: "", plan: "Free" };
    const g = agruparCerca([
      {
        ...base,
        usuario_id: "a",
        nombre: "Ana",
        recurso: "inventarios",
        inventario: null,
        usados: 1,
        max: 1,
      },
      {
        ...base,
        usuario_id: "b",
        nombre: "Beto",
        recurso: "productos",
        inventario: "X",
        usados: 85,
        max: 100,
      },
      {
        ...base,
        usuario_id: "a",
        nombre: "Ana",
        recurso: "personas",
        inventario: "Y",
        usados: 2,
        max: 2,
      },
    ]);
    expect(g.map((c) => c.nombre)).toEqual(["Ana", "Beto"]);
    expect(g[0]!.llenos).toBe(2);
    expect(g[0]!.recursos).toHaveLength(2);
    expect(g[1]!.peor).toBeCloseTo(0.85);
  });
});
