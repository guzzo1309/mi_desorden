import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configurarApp } from "../src/app.setup";
import { CoreModule } from "../src/core.module";
import { validarEnv } from "../src/shared/config/env";
import { sesion, USUARIO_ID } from "./sesion";

/** Levanta la app completa (mismo setup que el server) con el env que se pase. */
async function crearApp(env: Record<string, string> = {}) {
  const modulo = await Test.createTestingModule({ imports: [CoreModule] })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(validarEnv({ ...sesion.env, ...env })))
    .compile();
  const app = configurarApp(modulo.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

const INVENTARIO = "0b9a8c2e-1f3d-4c5b-9a7e-2d1c0b9a8c2e";
const OTRO_INVENTARIO = "7c6b5a49-3e2d-4f1c-8b0a-9e8d7c6b5a49";
const deteccion = { inventario_id: INVENTARIO, etiqueta: "caja", confianza: 0.91 };

describe("API", () => {
  let app: INestApplication;
  beforeEach(async () => {
    app = await crearApp();
  });
  afterEach(() => app.close());

  const api = () => request(app.getHttpServer());

  it("responde el health sin sesión", async () => {
    const res = await api().get("/api/v1/health").expect(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it("arranca sin detecciones", async () => {
    const res = await api()
      .get("/api/v1/detections")
      .set(await sesion.header())
      .expect(200);
    expect(res.body).toEqual({ items: [], total: 0 });
  });

  it("guarda una detección a nombre del usuario de la sesión", async () => {
    const creada = await api()
      .post("/api/v1/detections")
      .set(await sesion.header())
      .send(deteccion)
      .expect(201);
    expect(creada.body).toMatchObject({
      usuario_id: USUARIO_ID,
      inventario_id: INVENTARIO,
      producto_id: null,
    });

    const res = await api()
      .get("/api/v1/detections")
      .set(await sesion.header())
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].etiqueta).toBe("caja");
  });

  it("filtra por inventario", async () => {
    await api()
      .post("/api/v1/detections")
      .set(await sesion.header())
      .send(deteccion)
      .expect(201);
    await api()
      .post("/api/v1/detections")
      .set(await sesion.header())
      .send({ ...deteccion, inventario_id: OTRO_INVENTARIO })
      .expect(201);

    const res = await api()
      .get(`/api/v1/detections?inventario_id=${OTRO_INVENTARIO}`)
      .set(await sesion.header())
      .expect(200);
    expect(res.body.total).toBe(1);
  });

  it("cada usuario ve solo sus detecciones", async () => {
    await api()
      .post("/api/v1/detections")
      .set(await sesion.header())
      .send(deteccion)
      .expect(201);

    const otro = await sesion.header({ sub: "11111111-2222-4333-8444-555555555555" });
    const res = await api().get("/api/v1/detections").set(otro).expect(200);
    expect(res.body.total).toBe(0);
  });

  it("no deja crear detecciones sin sesión", async () => {
    await api().post("/api/v1/detections").send(deteccion).expect(401);
  });

  it("rechaza una confianza fuera de rango", async () => {
    const res = await api()
      .post("/api/v1/detections")
      .set(await sesion.header())
      .send({ ...deteccion, confianza: 4 })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([expect.stringContaining("confianza")]),
    );
  });

  it("rechaza un inventario que no es un UUID", async () => {
    await api()
      .post("/api/v1/detections")
      .set(await sesion.header())
      .send({ ...deteccion, inventario_id: "estante-a" })
      .expect(400);
  });

  it("da 404 con una ruta que no existe", async () => {
    const res = await api()
      .get("/api/v1/nada")
      .set(await sesion.header())
      .expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, path: "/api/v1/nada" });
  });

  it("sirve el swagger fuera de producción", async () => {
    await api().get("/api/v1/docs-json").expect(200);
  });
});

describe("Configuración de producción", () => {
  it("arranca sin DEVICE_TOKEN (ya no hay ESP32)", () => {
    expect(() => validarEnv({ ...sesion.env, NODE_ENV: "production" })).not.toThrow();
  });
});
