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

/** @deprecated Ya no se usan LEDs: la cámara reconoce el producto por su foto y su etiqueta. */
export type LedColor = "verde" | "azul" | "rojo" | "amarillo" | "violeta";

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  creado_en: string;
}

/**
 * Rol en un inventario (tabla roles, ámbito "inventario"). Se puede ser owner
 * de uno y lector de otro.
 */
export type Rol = "owner" | "editor" | "lector";

/** Rol de plataforma (tabla roles, ámbito "plataforma", en perfiles.rol_id). */
export type RolPlataforma = "admin";

/** Lo que permite un rol: una columna booleana de la tabla roles por permiso. */
export interface Permisos {
  ver: boolean;
  /** Cambiar solo la cantidad (cámara, ±). */
  ajustar_stock: boolean;
  /** Crear, editar y borrar productos y categorías; cargar facturas. */
  editar_productos: boolean;
  gestionar_fotos: boolean;
  /** Invitar y quitar gente (solo el owner). */
  gestionar_accesos: boolean;
  eliminar_inventario: boolean;
}

/** Fila de la tabla roles. */
export interface RolInfo extends Permisos {
  /** uuid */
  id: string;
  rol: Rol | RolPlataforma;
  ambito: "inventario" | "plataforma";
  descripcion: string;
}

export interface Miembro {
  usuario_id: string;
  nombre: string;
  email: string;
  rol: Rol;
  /** Si está mirando el inventario ahora mismo (presence de Realtime). */
  en_linea: boolean;
}

/** Invitación a un correo que todavía no tiene cuenta. La ve quien gestiona accesos. */
export interface InvitacionPendiente {
  email: string;
  rol: Exclude<Rol, "owner">;
  creado_en: string;
}

export interface Inventario {
  id: string;
  nombre: string;
  /** "Depósito", "Tienda centro", "Garage". */
  lugar: string;
  miembros: Miembro[];
  /** Vacío si no puedo gestionar accesos. */
  pendientes: InvitacionPendiente[];
  total_productos: number;
  creado_en: string;
}

/** Carpeta de productos. Un solo nivel de subcategorías (padre_id). */
export interface Categoria {
  id: string;
  inventario_id: string;
  /** Null = categoría principal. */
  padre_id: string | null;
  nombre: string;
  creado_en: string;
}

export interface Producto {
  id: string;
  inventario_id: string;
  nombre: string;
  /** Null solo en productos viejos que no tenían categoría. */
  categoria_id: string | null;
  /** @deprecated Texto viejo; la categoría es categoria_id. */
  categoria: string;
  cantidad: number;
  /** Por debajo de esto se marca como stock bajo. */
  minimo: number;
  /** Pasillo / estante, ej. "A2". */
  ubicacion: string;
  /** @deprecated Queda en la base, la app ya no lo usa. */
  led: LedColor;
  /** Quién hizo el último cambio: la persona o la cámara. */
  fuente: "manual" | "camara";
  /** Ruta en el bucket "productos" de Supabase Storage, o null si no tiene foto. */
  foto_path: string | null;
  /** Entró con una factura y el owner todavía no lo completó (categoría y foto). */
  por_revisar: boolean;
  actualizado_en: string;
}

export type ProductoInput = Pick<
  Producto,
  "nombre" | "categoria_id" | "cantidad" | "minimo" | "ubicacion"
>;

/** Una línea leída de una factura o un Excel: qué producto y cuántas unidades entraron. */
export interface LineaFactura {
  nombre: string;
  cantidad: number;
}

/** Cómo quedó cada producto después de cargar una factura. */
export interface ProductoCargado {
  producto: Producto;
  /** True si no existía y se creó; false si se le sumó la cantidad. */
  nuevo: boolean;
}

/** Pedido de un lector a quien edita el inventario (owner o editor). */
export interface Solicitud {
  id: string;
  inventario_id: string;
  /** Null en "agregar" o si el producto ya se borró. */
  producto_id: string | null;
  tipo: "agregar" | "eliminar" | "stock";
  /** Nombre del producto a agregar, o una aclaración. */
  detalle: string;
  /** Solo en "stock": la cantidad que se pide. */
  cantidad: number | null;
  estado: "pendiente" | "aceptada" | "rechazada";
  creado_por: string;
  creado_en: string;
  resuelto_en: string | null;
}

export type SolicitudInput = Pick<Solicitud, "tipo"> &
  Partial<Pick<Solicitud, "producto_id" | "detalle" | "cantidad">>;

/** Lo que devuelve GET /auth/me: la sesión según el JWT de Supabase. */
export interface UsuarioSesion {
  id: string;
  email: string | null;
  aal: string | null;
  sesion_id: string | null;
  expira_en: string;
}
