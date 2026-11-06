import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configurarApp } from "../src/app.setup";
import { CoreModule } from "../src/core.module";
import { validarEnv } from "../src/shared/config/env";
import { sesion } from "./sesion";

const CLAVE = "anon-de-pruebas";
const INVENTARIO = "0b9a8c2e-1f3d-4c5b-9a7e-2d1c0b9a8c2e";

let app: INestApplication;
let usos: { cuerpo: string }[] = [];
const fetchReal = globalThis.fetch;

/** Stub de Supabase: registra los POST a usos_api y contesta vacío el resto. */
function stubear() {
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    const texto = String(url);
    if (texto.includes("/rest/v1/usos_api")) {
      usos.push({ cuerpo: String(init?.body ?? "") });
      return new Response(null, { status: 201 });
    }
    if (texto.includes("/rest/v1/detecciones")) {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
}

async function crearApp() {
  const modulo = await Test.createTestingModule({ imports: [CoreModule] })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(validarEnv({ ...sesion.env, SUPABASE_ANON_KEY: CLAVE })))
    .compile();
  const app = configurarApp(modulo.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

describe("bitácora de uso", () => {
  beforeEach(async () => {
    usos = [];
    stubear();
    app = await crearApp();
  });

  afterEach(async () => {
    await app.close();
    globalThis.fetch = fetchReal;
  });

  it("registra el request autenticado con su inventario", async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/detections?inventario_id=${INVENTARIO}`)
      .set(await sesion.header())
      .expect(200);

    await Bun.sleep(80);

    expect(usos).toHaveLength(1);
    expect(JSON.parse(usos[0].cuerpo)).toMatchObject({
      inventario_id: INVENTARIO,
      ruta: "/api/v1/detections",
      metodo: "GET",
      estado: 200,
    });
  });

  it("no registra el health", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    await Bun.sleep(80);
    expect(usos).toHaveLength(0);
  });

  it("un fallo de red no rompe la respuesta", async () => {
    globalThis.fetch = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;

    await request(app.getHttpServer())
      .get("/api/v1/detections")
      .set(await sesion.header())
      .expect(200);
  });
});