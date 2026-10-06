import type { INestApplication } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ahoraIso } from "./fecha";

/**
 * Lista blanca de orígenes (CORS). Solo aplica a navegadores: la app móvil no
 * manda Origin y no se ve afectada.
 */

/** Normaliza y valida un origen: esquema + host [+ puerto], sin path. */
export function normalizarOrigen(valor: string): string {
  const crudo = valor.trim().replace(/\/$/, "");
  const url = new URL(crudo.includes("://") ? crudo : `https://${crudo}`);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.pathname !== "/" ||
    url.search ||
    url.username
  ) {
    throw new Error(`Origen CORS inválido: ${valor}`);
  }
  return url.origin;
}

export type FiltroOrigen = (origen: string | undefined) => boolean;

/** `*` permite todo (solo fuera de producción); si no, coincidencia exacta del origen. */
export function crearFiltroOrigen(permitidos: string[]): FiltroOrigen {
  if (permitidos.includes("*")) return () => true;
  const set = new Set(permitidos);
  return (origen) => {
    if (!origen) return true; // sin Origin: app móvil, curl
    try {
      return set.has(new URL(origen).origin) && new URL(origen).origin === origen;
    } catch {
      return false;
    }
  };
}

/**
 * Aplica la lista blanca a la app: un Origin fuera de la lista recibe 403
 * (también en el preflight); sin Origin pasa.
 */
export function aplicarCors(app: INestApplication, permitidos: string[]) {
  const permitido = crearFiltroOrigen(permitidos);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (permitido(req.headers.origin)) return next();
    res.status(403).json({
      statusCode: 403,
      error: "FORBIDDEN",
      message: "Origen no permitido",
      timestamp: ahoraIso(),
      path: req.url,
    });
  });
  app.enableCors({
    origin: (origen: string | undefined, cb: (e: Error | null, ok?: boolean) => void) =>
      cb(null, permitido(origen)),
  });
}
