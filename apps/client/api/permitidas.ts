/**
 * Lista blanca de URLs de la API por ambiente. La app no habla con un backend
 * que no esté acá: si EXPO_PUBLIC_API_URL apunta a otro lado, no arranca.
 * Sin dependencias de React Native para poder testearlo con bun test.
 */

export type Ambiente = "development" | "staging" | "production";

/** La API de stg en Vercel (proyecto mi-desorden, guzzo1309s-projects). */
export const API_STAGING = "https://mi-desorden.vercel.app/api/v1";

const PERMITIDAS: Record<Ambiente, (url: URL) => boolean> = {
  // Local: la máquina o la IP de la red (teléfono físico), siempre en /api/v1.
  development: (u) =>
    u.protocol === "http:" &&
    /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      u.hostname,
    ) &&
    u.pathname === "/api/v1",
  // Solo la API de stg en Vercel (dominio corto o el del team).
  staging: (u) =>
    u.protocol === "https:" &&
    ["mi-desorden.vercel.app", "mi-desorden-guzzo1309s-projects.vercel.app"].includes(u.hostname) &&
    !u.port &&
    u.pathname === "/api/v1",
  // Todavía no hay API de producción: no se permite ninguna.
  production: () => false,
};

const POR_DEFECTO: Record<Ambiente, string | null> = {
  development: "http://localhost:3000/api/v1",
  staging: API_STAGING,
  production: null,
};

export function ambienteDe(valor: string | undefined): Ambiente {
  const v = (valor ?? "").trim().toLowerCase();
  if (["staging", "stg"].includes(v)) return "staging";
  if (["production", "prd", "prod"].includes(v)) return "production";
  return "development";
}

/** Devuelve la URL de la API a usar o tira si no está en la lista blanca del ambiente. */
export function resolverApiUrl(ambiente: Ambiente, configurada: string | undefined): string {
  const crudo = (configurada?.trim() || POR_DEFECTO[ambiente] || "").replace(/\/$/, "");
  let url: URL;
  try {
    url = new URL(crudo);
  } catch {
    throw new Error(`EXPO_PUBLIC_API_URL no es una URL válida para ${ambiente}`);
  }
  if (url.username || url.password || url.search || url.hash || !PERMITIDAS[ambiente](url)) {
    throw new Error(`La API ${url.origin}${url.pathname} no está permitida en ${ambiente}`);
  }
  return crudo;
}
