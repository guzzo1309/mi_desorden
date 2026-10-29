/**
 * Única puerta al backend. Las pantallas y el store importan de "@/api" y no
 * saben si algo viene de Supabase o de la API de Nest.
 *
 * - auth, inventarios, productos, miembros, admin, realtime → Supabase (con RLS)
 * - detecciones → API de Nest (con el access token de Supabase)
 */
export { admin } from "./admin";
export { auth } from "./auth";
export { categorias } from "./categorias";
export { config } from "./config";
export { detecciones } from "./detecciones";
export { mensajeError } from "./errores";
export { inventarios } from "./inventarios";
export { miembros } from "./miembros";
export { movimientos, PAGINA_MOVIMIENTOS } from "./movimientos";
export { planes } from "./planes";
export { productos } from "./productos";
export { roles } from "./roles";
export { escucharInventario, escucharMisAccesos, type EventosInventario } from "./realtime";
