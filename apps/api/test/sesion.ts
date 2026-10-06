import { SignJWT } from "jose";

/** Proyecto de Supabase falso para los tests: JWT legacy HS256. */
const URL = "https://proyectotest.supabase.co";
const SECRETO = "secreto-de-pruebas-que-tiene-mas-de-32-caracteres";
export const USUARIO_ID = "6f1c2c1e-7b1a-4b8e-9c55-2f3d1d1b0a01";

type Opciones = Partial<{
  sub: string;
  role: string;
  iss: string;
  aud: string;
  exp: string | number;
  secreto: string;
}>;

async function token(o: Opciones = {}) {
  return new SignJWT({
    email: "ana@ejemplo.com",
    role: o.role ?? "authenticated",
    aal: "aal1",
    session_id: "s-1",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(o.sub ?? USUARIO_ID)
    .setIssuer(o.iss ?? `${URL}/auth/v1`)
    .setAudience(o.aud ?? "authenticated")
    .setIssuedAt()
    .setExpirationTime(o.exp ?? "1h")
    .sign(new TextEncoder().encode(o.secreto ?? SECRETO));
}

export const sesion = {
  env: { SUPABASE_URL: URL, SUPABASE_JWT_SECRET: SECRETO },
  token,
  header: async (o?: Opciones) => ({ Authorization: `Bearer ${await token(o)}` }),
};
