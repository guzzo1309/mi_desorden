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
 * Rol en un inventario (tabla roles, ámbito inventario). Se puede ser owner de
 * uno y lector de otro. El owner es el dueño; editor y lector, sus empleados.
 */
export type Rol = "owner" | "editor" | "lector";

/** Rol en MI DESORDEN (tabla roles, ámbito plataforma): el admin del sistema. */
export type RolPlataforma = "admin";

/** Lo que permite un rol: una columna booleana de la tabla roles por permiso. */
export interface Permisos {
  ver: boolean;
  /** Cambiar solo la cantidad (cámara, ±). */
  ajustar_stock: boolean;
  /** Crear, editar y borrar productos y categorías; cargar facturas. */
  editar_productos: boolean;
  gestionar_fotos: boolean;
  /** Invitar y quitar empleados (solo el owner). */
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

/** KPIs del panel de admin (función admin_resumen). */
export interface AdminResumen {
  cuentas: number;
  nuevas_7d: number;
  nuevas_30d: number;
  /** Cuentas que iniciaron sesión en los últimos 7 días. */
  activos_7d: number;
  inventarios: number;
  productos: number;
  categorias: number;
  invitaciones: number;
  /** Últimos 14 días, de más viejo a más nuevo. `dia` es YYYY-MM-DD. */
  altas_por_dia: { dia: string; altas: number }[];
  /** Cuentas de cada plan (los archivados solo si todavía tienen cuentas). */
  por_plan: { codigo: string; nombre: string; cuentas: number }[];
  /** Las más cerca de su límite (desde el 80 %): candidatas a cambiar de plan. */
  cerca_limite: CercaDelLimite[];
}

/** Una cuenta que está por llegar al límite de su plan. */
export interface CercaDelLimite {
  usuario_id: string;
  nombre: string;
  email: string;
  plan: string;
  recurso: "inventarios" | "productos" | "personas";
  /** Inventario donde pasa (productos y personas); null en inventarios. */
  inventario: string | null;
  usados: number;
  max: number;
}

/** Una cuenta en la lista del admin (función admin_usuarios). */
export interface AdminUsuario {
  id: string;
  nombre: string;
  email: string;
  creado_en: string;
  ultimo_acceso: string | null;
  inventarios: number;
  es_admin: boolean;
  plan_id: string;
  plan_nombre: string;
  suspendido: boolean;
}

/** Detalle de una cuenta para el admin (función admin_usuario_detalle). */
export interface AdminUsuarioDetalle {
  id: string;
  nombre: string;
  email: string;
  creado_en: string;
  ultimo_acceso: string | null;
  suspendido: boolean;
  es_admin: boolean;
  plan: { id: string; codigo: string; nombre: string };
  historial_planes: { plan: string; desde: string; hasta: string | null }[];
  /** Los que creó, con cuánto tienen. El contenido no se expone. */
  inventarios: {
    id: string;
    nombre: string;
    creado_en: string;
    productos: number;
    personas: number;
  }[];
  /** En cuántos inventarios de otras personas es miembro. */
  inventarios_ajenos: number;
}

/** Plan (tier) de MI DESORDEN. Un límite null es ilimitado. */
export interface Plan {
  id: string;
  /** Identificador estable (free, pro…); no cambia al renombrar. */
  codigo: string;
  nombre: string;
  descripcion: string;
  max_inventarios: number | null;
  max_productos: number | null;
  max_personas: number | null;
  /** Solo informativo: todavía no hay cobro. */
  precio_mensual: number | null;
  activo: boolean;
  orden: number;
}

/** Plan en la lista del admin, con cuántas cuentas lo tienen vigente. */
export interface AdminPlan extends Plan {
  suscriptores: number;
}

/** Lo que el admin manda al crear (sin id) o editar un plan. */
export type PlanInput = Omit<Plan, "id" | "orden"> & { id?: string; orden?: number };

/** Mi plan y cuánto llevo usado (función mi_plan). */
export type MiPlan = Pick<
  Plan,
  | "id"
  | "codigo"
  | "nombre"
  | "descripcion"
  | "max_inventarios"
  | "max_productos"
  | "max_personas"
  | "precio_mensual"
> & {
  /** Inventarios que creé: los que cuentan contra max_inventarios. */
  inventarios_usados: number;
};

/** Pedido de cambio de plan que hizo una cuenta y espera respuesta del admin. */
export interface PedidoPlan {
  id: string;
  plan_id: string;
  /** Nombre del plan pedido. */
  plan: string;
  motivo: string;
  creado_en: string;
}

/** Un pedido pendiente en la lista del admin (función admin_pedidos_plan). */
export interface AdminPedidoPlan {
  id: string;
  usuario_id: string;
  nombre: string;
  email: string;
  plan_actual: string;
  plan_pedido: string;
  motivo: string;
  creado_en: string;
}

/** Un pedido de plan ya resuelto (función admin_pedidos_resueltos). */
export interface AdminPedidoResuelto {
  id: string;
  usuario_id: string;
  nombre: string;
  plan_pedido: string;
  estado: "aprobado" | "rechazado" | "cancelado";
  motivo: string;
  creado_en: string;
  resuelto_en: string | null;
  /** Quién lo aprobó o rechazó; null si lo canceló el propio owner. */
  resuelto_por_nombre: string | null;
}

/** Límites de un inventario (los del plan de su owner) y cuánto lleva usado. Lo ve cualquier miembro. */
export interface LimitesInventario {
  plan: string;
  max_productos: number | null;
  max_personas: number | null;
  productos: number;
  /** Miembros más invitaciones pendientes. */
  personas: number;
}

/** Lo que manda el owner al crear la cuenta de un empleado. */
export interface CrearEmpleadoInput {
  email: string;
  nombre: string;
  /** Contraseña temporal: en el primer ingreso el empleado tiene que cambiarla. */
  clave: string;
  rol: "editor" | "lector";
  inventarios: string[];
}

export interface ResultadoEmpleado {
  /** false: ese correo ya tenía cuenta y se lo agregó sin tocar su contraseña. */
  creada: boolean;
  /** Inventarios a los que quedó agregado. */
  agregados: string[];
  errores: { inventario: string; mensaje: string }[];
  /**
   * true: el servidor no respondió y se dejó una invitación por correo. La persona
   * entra sola al inventario cuando crea su cuenta con ese correo.
   */
  invitado?: boolean;
}

/** Qué pasó con un producto (tabla movimientos, la escribe un trigger). */
export type TipoMovimiento = "creado" | "stock" | "editado" | "eliminado";

/** Un renglón del historial del inventario. Solo lo ve el owner. */
export interface Movimiento {
  id: number;
  producto_id: string | null;
  producto_nombre: string;
  /** Quién lo hizo; null si esa cuenta ya no existe. */
  usuario_id: string | null;
  usuario: { nombre: string } | null;
  tipo: TipoMovimiento;
  cantidad_antes: number | null;
  cantidad_despues: number | null;
  fuente: "manual" | "camara" | null;
  /** Solo en 'editado': campo → de / a. */
  detalle: Record<string, { de: string | number | null; a: string | number | null }>;
  creado_en: string;
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
  /** Hasta 2 fotos más (rutas en el bucket) para que el modelo lo reconozca mejor. */
  fotos_extra: string[];
  /** Entró con una factura y un admin todavía no lo completó (categoría y foto). */
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
