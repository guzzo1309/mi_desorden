import { describe, expect, it } from "bun:test";
import type { Categoria, Producto } from "@mi-desorden/core";
import { armarArbol, opcionesCategoria, rutaCategoria } from "./categorias";

const cat = (id: string, nombre: string, padre_id: string | null = null): Categoria => ({
  id,
  inventario_id: "inv",
  padre_id,
  nombre,
  creado_en: "",
});
const prod = (id: string, categoria_id: string | null, ubicacion = "A1"): Producto => ({
  id,
  inventario_id: "inv",
  nombre: id,
  categoria_id,
  categoria: "",
  cantidad: 1,
  minimo: 0,
  ubicacion,
  led: "verde",
  fuente: "manual",
  foto_path: null,
  por_revisar: false,
  actualizado_en: "",
});

const categorias = [
  cat("beb", "Bebidas"),
  cat("gas", "Gaseosas", "beb"),
  cat("agua", "aguas", "beb"),
  cat("lim", "Limpieza"),
];

describe("armarArbol", () => {
  it("anida subcategorías, ordena por nombre y suma los totales", () => {
    const { raices, sinCategoria } = armarArbol(categorias, [
      prod("coca", "gas", "B2"),
      prod("sprite", "gas", "B1"),
      prod("agua", "agua"),
      prod("jugo", "beb"),
      prod("lavandina", "lim"),
    ]);
    expect(raices.map((n) => n.categoria.nombre)).toEqual(["Bebidas", "Limpieza"]);
    const bebidas = raices[0]!;
    expect(bebidas.hijas.map((n) => n.categoria.nombre)).toEqual(["aguas", "Gaseosas"]);
    expect(bebidas.hijas[1]!.productos.map((p) => p.id)).toEqual(["sprite", "coca"]);
    expect(bebidas.productos.map((p) => p.id)).toEqual(["jugo"]);
    expect(bebidas.total).toBe(4);
    expect(raices[1]!.total).toBe(1);
    expect(sinCategoria).toEqual([]);
  });

  it("deja aparte los productos sin categoría o con una que ya no existe", () => {
    const { sinCategoria } = armarArbol(categorias, [prod("a", null), prod("b", "borrada")]);
    expect(sinCategoria.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("muestra las categorías vacías", () => {
    expect(armarArbol(categorias, []).raices[1]!.total).toBe(0);
  });
});

describe("rutaCategoria", () => {
  it("arma el nombre con el padre", () => {
    expect(rutaCategoria(categorias, "gas")).toBe("Bebidas › Gaseosas");
    expect(rutaCategoria(categorias, "lim")).toBe("Limpieza");
    expect(rutaCategoria(categorias, null)).toBe("");
    expect(rutaCategoria(categorias, "no-existe")).toBe("");
  });
});

describe("opcionesCategoria", () => {
  it("lista cada principal seguida de sus subcategorías", () => {
    expect(opcionesCategoria(categorias).map((o) => o.etiqueta)).toEqual([
      "Bebidas",
      "Bebidas › aguas",
      "Bebidas › Gaseosas",
      "Limpieza",
    ]);
  });
});
