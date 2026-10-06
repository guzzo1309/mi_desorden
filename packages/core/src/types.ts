/** Tipos compartidos entre la API y el cliente Expo. */

/** Algo que la cámara del teléfono reconoció. */
export interface Detection {
  id: string;
  /** Quién la hizo (sesión de Supabase). */
  usuario_id: string;
  /** Inventario que se estaba mirando, si había uno abierto. */
  inventario_id: string | null;
  /** Producto con el que se asoció, si se reconoció uno del inventario. */
  producto_id: string | null;
  /** Qué se detectó: "caja", "bolsa", "herramienta". */
  etiqueta: string;
  /** 0 a 1. */
  confianza: number;
  /** Recorte del frame, si se guardó. */
  imagen_url: string | null;
  creada_en: string;
}

/** Lo que manda la app al reconocer algo con la cámara. */
export interface DetectionInput {
  inventario_id?: string | null;
  producto_id?: string | null;
  etiqueta: string;
  confianza: number;
  imagen_url?: string | null;
}

export interface Paginado<T> {
  items: T[];
  total: number;
}

/* ---------- Inventario (Sprint 1) ---------- */

/** Color del LED que marca el lugar de un producto en la estantería. */
export type LedColor = "verde" | "azul" | "rojo" | "amarillo" | "violeta";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  creado_en: string;
}

export type Rol = "dueño" | "editor" | "lector";

export interface Miembro {
  usuario_id: string;
  nombre: string;
  email: string;
  rol: Rol;
  /** Si está mirando el inventario ahora mismo (presence de Realtime). */
  en_linea: boolean;
}

export interface Inventario {
  id: string;
  nombre: string;
  /** "Depósito", "Tienda centro", "Garage". */
  lugar: string;
  miembros: Miembro[];
  total_productos: number;
  creado_en: string;
}

export interface Producto {
  id: string;
  inventario_id: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  /** Por debajo de esto se marca como stock bajo. */
  minimo: number;
  /** Pasillo / estante, ej. "A2". */
  ubicacion: string;
  led: LedColor;
  /** Quién hizo el último cambio: la persona o la cámara. */
  fuente: "manual" | "camara";
  actualizado_en: string;
}

export type ProductoInput = Pick<
  Producto,
  "nombre" | "categoria" | "cantidad" | "minimo" | "ubicacion" | "led"
>;

/** Lo que devuelve GET /auth/me: la sesión según el JWT de Supabase. */
export interface UsuarioSesion {
  id: string;
  email: string | null;
  aal: string | null;
  sesion_id: string | null;
  expira_en: string;
}
