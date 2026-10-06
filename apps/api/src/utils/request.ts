import type { Request } from "express";

/**
 * IP de quien llama. Con `trust proxy` (Vercel) es la del cliente y no la del
 * proxy; la usan el bloqueo por intentos fallidos y los logs.
 */
export function ipDe(req: Pick<Request, "ip" | "socket">): string {
  return req.ip ?? req.socket?.remoteAddress ?? "desconocida";
}
