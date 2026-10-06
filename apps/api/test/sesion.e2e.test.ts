import "reflect-metadata";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import request from "supertest";
import { configurarApp } from "../src/app.setup";
import { CoreModule } from "../src/core.module";
import { validarEnv } from "../src/shared/config/env";
import { sesion, USUARIO_ID } from "./sesion";

async function crearApp(env: Record<string, string | number>) {
  const modulo = await Test.createTestingModule({ imports: [CoreModule] })
    .overrideProvider(ConfigService)
    .useValue(new ConfigService(validarEnv(env)))
    .compile();
  const app = configurarApp(modulo.createNestApplication({ logger: false }));
  await app.init();
  return app;
}

describe("Sesión (JWT legacy HS256)", () => {
  let app: INestApplication;
  beforeEach(async () => {
    app = await crearApp({ ...sesion.env, AUTH_MAX_FALLOS: 3 });
  });
  afterEach(() => app.close());

  const me = () => request(app.getHttpServer()).get("/api/v1/auth/me");

  it("pide token en las rutas protegidas", async () => {
    const res = await me().expect(401);
    expect(res.body.message).toBe("Falta el token de sesión");
  });

  it("acepta un access token válido y devuelve el usuario", async () => {
    const res = await me()
      .set(await sesion.header())
      .expect(200);
    expect(res.body).toMatchObject({ id: USUARIO_ID, email: "ana@ejemplo.com", aal: "aal1" });
  });

  it("rechaza un token vencido", async () => {
    await me()
      .set(await sesion.header({ exp: Math.floor(Date.now() / 1000) - 60 }))
      .expect(401);
  });

  it("rechaza un token firmado con otra clave", async () => {
    await me()
      .set(await sesion.header({ secreto: "otra-clave-cualquiera-de-mas-de-32-caracteres" }))
      .expect(401);
  });

  it("rechaza un token de otro proyecto", async () => {
    await me()
      .set(await sesion.header({ iss: "https://otro.supabase.co/auth/v1" }))
      .expect(401);
  });

  it("rechaza la anon key aunque sea un JWT del proyecto", async () => {
    await me()
      .set(await sesion.header({ role: "anon", aud: "authenticated" }))
      .expect(401);
  });

  it("rechaza un header que no es Bearer", async () => {
    await me()
      .set("Authorization", `Basic ${await sesion.token()}`)
      .expect(401);
  });

  it("no le dice al cliente por qué falló", async () => {
    const res = await me()
      .set(await sesion.header({ exp: Math.floor(Date.now() / 1000) - 60 }))
      .expect(401);
    expect(res.body.message).toBe("Sesión inválida o vencida");
  });

  it("bloquea la IP después de varios tokens inválidos, aunque después mande uno válido", async () => {
    for (let i = 0; i < 3; i++) await me().set("Authorization", "Bearer basura").expect(401);

    const res = await me()
      .set(await sesion.header())
      .expect(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("health no pide sesión", async () => {
    await request(app.getHttpServer()).get("/api/v1/health").expect(200);
  });

  it("manda headers de seguridad", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("Sesión (claves asimétricas por JWKS)", () => {
  let supabaseFalso: ReturnType<typeof Bun.serve>;
  let firmar: (o?: { kid?: string }) => Promise<string>;
  let app: INestApplication;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256");
    const jwk = { ...(await exportJWK(publicKey)), kid: "clave-1", alg: "ES256", use: "sig" };
    supabaseFalso = Bun.serve({
      port: 0,
      fetch: (req) =>
        new URL(req.url).pathname === "/auth/v1/.well-known/jwks.json"
          ? Response.json({ keys: [jwk] })
          : new Response("no", { status: 404 }),
    });
    const iss = `http://localhost:${supabaseFalso.port}/auth/v1`;
    firmar = (o = {}) =>
      new SignJWT({ email: "ana@ejemplo.com", role: "authenticated" })
        .setProtectedHeader({ alg: "ES256", kid: o.kid ?? "clave-1" })
        .setSubject(USUARIO_ID)
        .setIssuer(iss)
        .setAudience("authenticated")
        .setExpirationTime("1h")
        .sign(privateKey);

    app = await crearApp({ SUPABASE_URL: `http://localhost:${supabaseFalso.port}` });
  });

  afterAll(async () => {
    await app.close();
    supabaseFalso.stop(true);
  });

  it("verifica con la clave pública del proyecto", async () => {
    const res = await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${await firmar()}`)
      .expect(200);
    expect(res.body.id).toBe(USUARIO_ID);
  });

  it("rechaza un kid que no está en el JWKS", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${await firmar({ kid: "inventada" })}`)
      .expect(401);
  });
});

describe("Configuración", () => {
  it("no arranca con la cadena de Postgres en vez de la URL, y no la imprime", () => {
    const cadena = "postgresql://postgres:clave-secreta@db.abc.supabase.co:5432/postgres";
    expect(() => validarEnv({ EXPO_PUBLIC_SUPABASE_URL: cadena })).toThrow(/no es la URL https/);
    try {
      validarEnv({ EXPO_PUBLIC_SUPABASE_URL: cadena });
    } catch (e) {
      expect((e as Error).message).not.toContain("clave-secreta");
    }
  });

  it("toma EXPO_PUBLIC_SUPABASE_URL si no hay SUPABASE_URL", () => {
    expect(validarEnv({ EXPO_PUBLIC_SUPABASE_URL: "https://abc.supabase.co/" }).SUPABASE_URL).toBe(
      "https://abc.supabase.co",
    );
  });
});
