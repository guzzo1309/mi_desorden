import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "./shared/config/env";
import { aplicarCors, aplicarFiltros, aplicarPipes, aplicarSeguridad, crearSwagger } from "./utils";

/** Todas las rutas cuelgan de acá, igual que en canchapp: /api/v1/health, /api/v1/detections… */
export const PREFIJO = "api/v1";

/** Todo lo global de la app. Lo usan server.ts, serverless.ts y los tests e2e, así prueban lo mismo. */
export function configurarApp<T extends INestApplication>(app: T): T {
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix(PREFIJO);
  aplicarSeguridad(app);
  aplicarCors(app, config.get("CORS_ORIGINS", { infer: true }));
  aplicarPipes(app);
  aplicarFiltros(app);

  if (
    config.get("NODE_ENV", { infer: true }) !== "production" ||
    process.env.ENABLE_SWAGGER === "true"
  ) {
    crearSwagger(app, PREFIJO);
  }
  return app;
}
