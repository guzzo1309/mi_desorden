/**
 * Funciones compartidas por varios módulos y por los puntos de entrada
 * (server.ts, serverless.ts). Funciones planas, sin providers de Nest: lo que
 * vive dentro de Nest (guards, filtros, config) está en shared/.
 */
export { aplicarCors, crearFiltroOrigen, type FiltroOrigen, normalizarOrigen } from "./cors";
export { ahoraIso } from "./fecha";
export { aplicarFiltros } from "./filters";
export { paginar } from "./paginado";
export { aplicarPipes } from "./pipes";
export { ipDe } from "./request";
export { aplicarSeguridad } from "./seguridad";
export { crearSwagger } from "./swagger";
