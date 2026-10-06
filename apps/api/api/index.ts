/** GET /api (y / por rewrite). Responde sin cargar Nest: sirve para ver que el deploy vive. */
export default function handler(
  _req: unknown,
  res: { status: (n: number) => { json: (o: object) => void } },
) {
  res.status(200).json({
    message: "mi_desorden API 🚀",
    version: "0.2.0",
    endpoints: { health: "/api/v1/health", liveness: "/api/v1/health/liveness", api: "/api/v1" },
    status: "OK",
    timestamp: new Date().toISOString(),
  });
}
