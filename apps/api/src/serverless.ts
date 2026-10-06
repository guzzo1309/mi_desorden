import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Request, Response } from "express";
import { configurarApp } from "./app.setup";
import { CoreModule } from "./core.module";

/**
 * Handler para Vercel (lo llaman las funciones de apps/api/api/). Nest arranca
 * una sola vez por instancia y se reutiliza entre requests.
 */

const logger = new Logger("Serverless");

let servidor: ((req: Request, res: Response) => void) | null = null;
/** Evita arrancar Nest varias veces en paralelo cuando llegan muchas requests en frío. */
let arrancando: Promise<void> | null = null;

async function arrancar() {
  const inicio = Date.now();
  const app = await NestFactory.create<NestExpressApplication>(CoreModule, {
    // Vercel corta los logs por invocación: en frío, los "Mapped route" se comerían el cupo.
    logger: process.env.NODE_ENV === "development" ? undefined : ["error", "warn"],
  });
  configurarApp(app);
  await app.init();
  servidor = app.getHttpAdapter().getInstance();
  logger.log(`Nest listo en ${Date.now() - inicio}ms`);
}

async function obtenerServidor() {
  if (servidor) return servidor;
  arrancando ??= arrancar().catch((e) => {
    arrancando = null;
    throw e;
  });
  await arrancando;
  return servidor!;
}

export default async function handler(req: Request, res: Response) {
  try {
    const app = await obtenerServidor();
    return app(req, res);
  } catch (e) {
    logger.error(`No arrancó Nest: ${(e as Error).message}`, (e as Error).stack);
    if (!res.headersSent) {
      res.status(500).json({
        statusCode: 500,
        error: "INTERNAL_SERVER_ERROR",
        message: "Error interno del servidor",
      });
    }
  }
}

// En Vercel se arranca apenas se carga el módulo para ganarle tiempo al primer request.
if (process.env.VERCEL === "1") {
  obtenerServidor().catch((e) => logger.warn(`Arranque anticipado falló: ${(e as Error).message}`));
}
