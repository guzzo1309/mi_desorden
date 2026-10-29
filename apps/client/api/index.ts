/**
 * Única puerta al backend. Las pantallas y el store importan de "@/api" y no
 * saben si algo viene de Supabase o de la API de Nest.
 *
 * - auth, inventarios, productos, miembros, realtime → Supabase (con RLS)
 * - detecciones → API de Nest (con el access token de Supabase)
 */
export { auth } from "./auth";
export { categorias } from "./categorias";
export { config } from "./config";
export { detecciones } from "./detecciones";
export { mensajeError } from "./errores";
export { inventarios } from "./inventarios";
export { miembros } from "./miembros";
export { productos } from "./productos";
export { roles } from "./roles";
export { escucharInventario, escucharMisAccesos, type EventosInventario } from "./realtime";
