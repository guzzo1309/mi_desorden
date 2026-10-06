import { describe, expect, it } from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configurarApp } from "../src/app.setup";
import { CoreModule } from "../src/core.module";
import { validarEnv } from "../src/shared/config/env";
import { sesion } from "./sesion";

async function crearApp(env: Record<string, string>): Promise<INestApplication> {
  const modulo = await Test.createTestingModule({ imports: [CoreModule] })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(validarEnv({ ...sesion.env, ...env })))
    .compile();
  const app = configurarApp(modulo.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

const PROD = { NODE_ENV: "production" };

describe("Lista blanca CORS", () => {
  it("deja pasar un origen permitido con sus headers", async () => {
    const app = await crearApp({ CORS_ORIGIN: "https://stg.midesorden.app" });
    const res = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "https://stg.midesorden.app")
      .expect(200);
    expect(res.headers["access-control-allow-origin"]).toBe("https://stg.midesorden.app");
    await app.close();
  });

  it("rechaza con 403 un origen que no está en la lista", async () => {
    const app = await crearApp({ CORS_ORIGIN: "https://stg.midesorden.app" });
    const res = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "https://evil.com")
      .expect(403);
    expect(res.body.message).toBe("Origen no permitido");
    await app.close();
  });

  it("rechaza también el preflight de un origen no permitido", async () => {
    const app = await crearApp({ CORS_ORIGIN: "https://stg.midesorden.app" });
    await request(app.getHttpServer())
      .options("/api/v1/detections")
      .set("Origin", "https://stg.midesorden.app.evil.com")
      .set("Access-Control-Request-Method", "GET")
      .expect(403);
    await app.close();
  });

  it("sin Origin (app móvil) no se bloquea", async () => {
    const app = await crearApp({ ...PROD });
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    await app.close();
  });

  it("en producción sin CORS_ORIGIN solo entra la propia URL de Vercel", async () => {
    const app = await crearApp({
      ...PROD,
      VERCEL_PROJECT_PRODUCTION_URL: "mi-desorden.vercel.app",
    });
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "https://mi-desorden.vercel.app")
      .expect(200);
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "http://localhost:8081")
      .expect(403);
    await app.close();
  });

  it("en desarrollo sin CORS_ORIGIN se permite todo", async () => {
    const app = await crearApp({});
    await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("Origin", "http://localhost:8081")
      .expect(200);
    await app.close();
  });
});

describe("Validación de CORS_ORIGIN", () => {
  it("no permite * en producción", () => {
    expect(() => validarEnv({ ...sesion.env, ...PROD, CORS_ORIGIN: "*" })).toThrow(
      /no está permitido en producción/,
    );
  });

  it("no acepta un origen con path", () => {
    expect(() => validarEnv({ ...sesion.env, CORS_ORIGIN: "https://a.com/algo" })).toThrow(
      /Origen CORS inválido/,
    );
  });
});
