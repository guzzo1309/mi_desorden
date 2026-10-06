/**
 * Entrada serverless de Vercel: /api/v1/* llega acá por rewrite y se lo pasa a
 * Nest (dist/serverless.js). Require estático para que Vercel incluya dist.
 *
 * Vercel a veces entrega la ruta relativa a la función (/v1/health en vez de
 * /api/v1/health): se normaliza para que Nest reciba el path con su prefijo.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nest = require("../dist/serverless").default;

function normalizarUrl(req: IncomingMessage) {
  const crudo = req.url ?? "";
  const [ruta = "", query = ""] = crudo.split(/\?(.*)/s);
  if (ruta && !ruta.startsWith("/api")) {
    req.url = `/api${ruta.startsWith("/") ? "" : "/"}${ruta}${query ? `?${query}` : ""}`;
  }
}

/** async + await: si no se espera el handler de Nest, un rechazo puede tumbar la función. */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  normalizarUrl(req);
  return await nest(req, res);
}
