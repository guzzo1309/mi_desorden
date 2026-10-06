/** GET /api/v1/health por Nest: si responde, la app arranca de verdad (env, módulos). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nest = require("../../../dist/serverless").default;

export default async function handler(req: unknown, res: unknown) {
  return await nest(req, res);
}
