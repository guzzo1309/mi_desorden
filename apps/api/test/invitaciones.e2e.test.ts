import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configurarApp } from "../src/app.setup";
import { CoreModule } from "../src/core.module";
import { validarEnv } from "../src/shared/config/env";
import { sesion, USUARIO_ID } from "./sesion";

const INV = "0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601";
const OTRO = "6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d";

/** Lo que devolvería PostgREST para el dueño (RLS ya aplicado). */
function inventario(
  o: { id?: string; gestiono?: boolean; miembro?: string; pendiente?: string } = {},
) {
  return {
    id: o.id ?? INV,
    nombre: "Bodega <norte>",
    miembros: [
      {
        usuario_id: USUARIO_ID,
        rol: { gestionar_accesos: o.gestiono ?? true },
        perfiles: { nombre: "Ana", email: "ana@ejemplo.com" },
      },
      ...(o.miembro
        ? [
            {
              usuario_id: OTRO,
              rol: { gestionar_accesos: false },
              perfiles: { nombre: "Beto", email: o.miembro },
            },
          ]
        : []),
    ],
    invitaciones: o.pendiente ? [{ email: o.pendiente }] : [],
  };
}

describe("Invitaciones", () => {
  let app: INestApplication;
  let enviados: { url: string; body: Record<string, unknown> }[];
  let filas: unknown[];
  let resendOk: boolean;

  beforeEach(async () => {
    enviados = [];
    filas = [];
    resendOk = true;
    spyOn(globalThis, "fetch").mockImplementation((async (
      entrada: URL | string,
      init?: RequestInit,
    ) => {
      const url = String(entrada);
      if (url.includes("/rest/v1/inventarios")) return Response.json(filas);
      if (url.startsWith("https://api.resend.com")) {
        enviados.push({ url, body: JSON.parse(String(init?.body)) });
        return resendOk ? Response.json({ id: "x" }) : new Response("no", { status: 422 });
      }
      throw new Error(`fetch inesperado: ${url}`);
    }) as typeof fetch);

    const env = validarEnv({
      ...sesion.env,
      SUPABASE_ANON_KEY: "anon",
      RESEND_API_KEY: "re_test",
      API_PUBLIC_URL: "https://api.ejemplo.com",
    });
    const modulo = await Test.createTestingModule({ imports: [CoreModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService(env))
      .compile();
    app = configurarApp(modulo.createNestApplication({ logger: false }));
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    (globalThis.fetch as unknown as { mockRestore: () => void }).mockRestore();
  });

  const avisar = async (body: object) =>
    request(app.getHttpServer())
      .post("/api/v1/invitaciones/aviso")
      .set(await sesion.header())
      .send(body);

  it("manda el correo a alguien que ya es miembro, con el enlace a la app", async () => {
    filas = [inventario({ miembro: "beto@ejemplo.com" })];
    const res = await avisar({ email: " Beto@Ejemplo.com ", inventarios: [INV] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enviado: true, pendiente: false });
    const correo = enviados[0]!.body;
    expect(correo.to).toEqual(["beto@ejemplo.com"]);
    expect(correo.subject).toBe("Ana te dio acceso a “Bodega <norte>”");
    expect(String(correo.html)).toContain("Bodega &lt;norte&gt;");
    expect(String(correo.html)).toContain(
      `https://api.ejemplo.com/api/v1/invitaciones/abrir?inv=${INV}`,
    );
  });

  it("a quien no tiene cuenta le pide registrarse", async () => {
    filas = [inventario({ pendiente: "nuevo@ejemplo.com" })];
    const res = await avisar({ email: "nuevo@ejemplo.com", inventarios: [INV] });
    expect(res.status).toBe(200);
    expect(res.body.pendiente).toBe(true);
    expect(String(enviados[0]!.body.html)).toContain("registro=1");
  });

  it("no manda nada si el correo no está invitado (no sirve para spam)", async () => {
    filas = [inventario()];
    const res = await avisar({ email: "cualquiera@ejemplo.com", inventarios: [INV] });
    expect(res.status).toBe(403);
    expect(enviados).toHaveLength(0);
  });

  it("no manda nada si quien llama no puede gestionar accesos", async () => {
    filas = [inventario({ gestiono: false, miembro: "beto@ejemplo.com" })];
    expect((await avisar({ email: "beto@ejemplo.com", inventarios: [INV] })).status).toBe(403);
    expect(enviados).toHaveLength(0);
  });

  it("no manda nada si algún inventario no es visible", async () => {
    filas = [inventario({ miembro: "beto@ejemplo.com" })];
    const res = await avisar({ email: "beto@ejemplo.com", inventarios: [INV, OTRO] });
    expect(res.status).toBe(403);
    expect(enviados).toHaveLength(0);
  });

  it("valida el cuerpo", async () => {
    expect((await avisar({ email: "no-es-correo", inventarios: [INV] })).status).toBe(400);
    expect((await avisar({ email: "a@b.com", inventarios: [] })).status).toBe(400);
    expect((await avisar({ email: "a@b.com", inventarios: ["x"] })).status).toBe(400);
  });

  it("si Resend falla responde 502", async () => {
    filas = [inventario({ miembro: "beto@ejemplo.com" })];
    resendOk = false;
    expect((await avisar({ email: "beto@ejemplo.com", inventarios: [INV] })).status).toBe(502);
  });

  it("pide sesión", async () => {
    await request(app.getHttpServer()).post("/api/v1/invitaciones/aviso").send({}).expect(401);
  });

  it("la página de abrir es pública y solo acepta un id válido", async () => {
    const ok = await request(app.getHttpServer())
      .get(`/api/v1/invitaciones/abrir?inv=${INV}`)
      .expect(200);
    expect(ok.text).toContain(`midesorden://abrir?inv=${INV}`);
    const malo = await request(app.getHttpServer())
      .get('/api/v1/invitaciones/abrir?inv="><script>')
      .expect(200);
    expect(malo.text).not.toContain("<script>");
    expect(malo.text).toContain('href="midesorden://"');
  });
});
