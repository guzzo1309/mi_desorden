import { describe, expect, it } from "bun:test";
import { createServer } from "node:http";
import request from "supertest";
import handler from "../src/serverless";

/** Como la función de Vercel: un req/res de node:http directo al handler. */
const app = createServer((req, res) => void handler(req as never, res as never));

/** El mismo camino que recorre una request en Vercel: función → handler → Nest. */
describe("Handler serverless", () => {
  it("arranca Nest y responde con el prefijo /api/v1", async () => {
    const res = await request(app).get("/api/v1/health").expect(200);
    expect(res.body.ok).toBe(true);
  });

  it("reutiliza la misma instancia entre requests", async () => {
    const inicio = Date.now();
    await request(app).get("/api/v1/health").expect(200);
    expect(Date.now() - inicio).toBeLessThan(500);
  });

  it("aplica el guard de sesión", async () => {
    await request(app).get("/api/v1/detections").expect(401);
  });
});
