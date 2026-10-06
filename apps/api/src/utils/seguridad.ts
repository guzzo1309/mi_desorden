import type { INestApplication } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";

/** Headers de seguridad y proxy de confianza. */
export function aplicarSeguridad(app: INestApplication) {
  // Detrás del proxy de Vercel, sin esto req.ip es la IP del proxy: el bloqueo
  // por intentos fallidos y el rate limit le pegarían a todos juntos.
  if (process.env.VERCEL) (app as NestExpressApplication).set("trust proxy", 1);

  // Sin CSP: la API solo devuelve JSON y Swagger UI usa scripts inline.
  app.use(helmet({ contentSecurityPolicy: false }));
}
