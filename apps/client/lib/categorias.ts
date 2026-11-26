import type { Categoria, Producto } from "@mi-desorden/core";

/** Una carpeta del inventario: sus subcategorías y sus productos. */
export interface NodoCategoria {
  categoria: Categoria;
  hijas: NodoCategoria[];
  productos: Producto[];
  /** Productos propios más los de las subcategorías. */
  total: number;
}

const porNombre = (a: { nombre: string }, b: { nombre: string }) =>
  a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });

/**
 * Arma las carpetas: categorías principales con sus subcategorías, cada una
 * con sus productos (ordenados por estante). Los productos sin categoría (o
 * con una que ya no existe) quedan aparte.
 */
export function armarArbol(categorias: Categoria[], productos: Producto[]) {
  const nodos = new Map<string, NodoCategoria>(
    categorias.map((c) => [c.id, { categoria: c, hijas: [], productos: [], total: 0 }]),
  );
  const sinCategoria: Producto[] = [];

  for (const p of productos) {
    const nodo = p.categoria_id ? nodos.get(p.categoria_id) : undefined;
    if (nodo) nodo.productos.push(p);
    else sinCategoria.push(p);
  }

  const raices: NodoCategoria[] = [];
  for (const nodo of nodos.values()) {
    const padre = nodo.categoria.padre_id ? nodos.get(nodo.categoria.padre_id) : undefined;
    if (padre) padre.hijas.push(nodo);
    else raices.push(nodo);
  }

  const ordenar = (lista: NodoCategoria[]) => {
    lista.sort((a, b) => porNombre(a.categoria, b.categoria));
    for (const n of lista) {
      n.productos.sort((a, b) => a.ubicacion.localeCompare(b.ubicacion) || porNombre(a, b));
      ordenar(n.hijas);
      n.total = n.productos.length + n.hijas.reduce((t, h) => t + h.total, 0);
    }
  };
  ordenar(raices);

  return { raices, sinCategoria };
}

/** "Bebidas" o "Bebidas › Gaseosas". Vacío si no existe. */
export function rutaCategoria(categorias: Categoria[], id: string | null | undefined): string {
  const c = id ? categorias.find((x) => x.id === id) : undefined;
  if (!c) return "";
  const padre = c.padre_id ? categorias.find((x) => x.id === c.padre_id) : undefined;
  return padre ? `${padre.nombre} › ${c.nombre}` : c.nombre;
}

/** Opciones para elegir categoría: cada principal seguida de sus subcategorías. */
export function opcionesCategoria(categorias: Categoria[]) {
  const principales = categorias.filter((c) => !c.padre_id).sort(porNombre);
  return principales.flatMap((p) => [
    { id: p.id, etiqueta: p.nombre },
    ...categorias
      .filter((c) => c.padre_id === p.id)
      .sort(porNombre)
      .map((c) => ({ id: c.id, etiqueta: `${p.nombre} › ${c.nombre}` })),
  ]);
}

/**
 * Firma de cómo se ve una carpeta: nombre y estilo de la categoría y de sus
 * subcategorías. Cambia cuando cualquiera de esas cosas cambia.
 */
export function firmaCarpeta(nodo: NodoCategoria): string {
  const una = (c: Categoria) =>
    [c.id, c.nombre, c.icono, c.imagen_path, c.color, c.fuente].map((x) => x ?? "").join("|");
  return [una(nodo.categoria), ...nodo.hijas.map((h) => una(h.categoria))].join("/");
}
