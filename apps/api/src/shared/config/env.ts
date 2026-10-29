import { normalizarOrigen } from "../../utils/cors";

/** Valida y normaliza las variables de entorno al arrancar. */
export function validarEnv(crudo: Record<string, unknown>) {
  const texto = (k: string) => (crudo[k] == null ? "" : String(crudo[k]).trim());

  const env = {
    NODE_ENV: texto("NODE_ENV") || "development",
    PORT: Number(texto("PORT") || 3000),
    /** Lista blanca de orígenes del navegador (ver origenesPermitidos). */
    CORS_ORIGINS: [] as string[],
    /** La misma URL que usa la app; en Doppler alcanza con EXPO_PUBLIC_SUPABASE_URL. */
    SUPABASE_URL: (texto("SUPABASE_URL") || texto("EXPO_PUBLIC_SUPABASE_URL")).replace(/\/$/, ""),
    /** Solo para proyectos con JWT legacy (HS256). Los nuevos firman con claves asimétricas (JWKS). */
    SUPABASE_JWT_SECRET: texto("SUPABASE_JWT_SECRET"),
    /** Tokens inválidos que se toleran por IP antes de bloquearla. */
    /** Clave pública del proyecto: la API consulta la base como el usuario que llama (con RLS). */
    SUPABASE_ANON_KEY: texto("SUPABASE_ANON_KEY") || texto("EXPO_PUBLIC_SUPABASE_KEY"),
    /**
     * Clave secreta del proyecto (service role): solo para crear cuentas de empleados con
     * Auth admin. Nunca sale del servidor. Sin ella, POST /empleados responde 503.
     */
    SUPABASE_SERVICE_ROLE_KEY: texto("SUPABASE_SERVICE_ROLE_KEY") || texto("SUPABASE_SECRET_KEY"),
    /** Correos de invitación. Sin clave, el aviso responde 503 y la invitación igual queda hecha. */
    RESEND_API_KEY: texto("RESEND_API_KEY"),
    /** Remitente. onboarding@resend.dev solo entrega a la cuenta dueña de Resend: verifica un dominio. */
    MAIL_FROM: texto("MAIL_FROM") || "mi_desorden <onboarding@resend.dev>",
    /**
     * URL pública de la API para los enlaces de los correos. Nunca sale de los
     * headers del request (se podrían falsear). En Vercel alcanza con la URL de producción.
     */
    API_PUBLIC_URL: (
      texto("API_PUBLIC_URL") ||
      (texto("VERCEL_PROJECT_PRODUCTION_URL")
        ? `https://${texto("VERCEL_PROJECT_PRODUCTION_URL")}`
        : `http://localhost:${texto("PORT") || 3000}`)
    ).replace(/\/$/, ""),
    AUTH_MAX_FALLOS: Number(texto("AUTH_MAX_FALLOS") || 10),
    AUTH_BLOQUEO_MIN: Number(texto("AUTH_BLOQUEO_MIN") || 15),
  };

  if (!Number.isInteger(env.PORT) || env.PORT <= 0) {
    throw new Error(`PORT inválido: ${texto("PORT")}`);
  }
  env.CORS_ORIGINS = origenesPermitidos(texto, env.NODE_ENV === "production");

  // Nunca se imprime el valor: si alguien pegó la cadena de Postgres, trae la contraseña.
  if (
    !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(env.SUPABASE_URL) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(env.SUPABASE_URL)
  ) {
    throw new Error(
      "SUPABASE_URL (o EXPO_PUBLIC_SUPABASE_URL) falta o no es la URL https del proyecto (https://<ref>.supabase.co). No uses la cadena de conexión de Postgres.",
    );
  }
  return env;
}

/**
 * CORS_ORIGIN: lista separada por comas. En desarrollo, vacío = `*`. En
 * producción `*` no se permite y, vacío, solo entra la propia URL de Vercel
 * (para Swagger). Las URLs del deploy las agrega Vercel solo (VERCEL_*_URL).
 */
function origenesPermitidos(texto: (k: string) => string, produccion: boolean): string[] {
  const configurados = texto("CORS_ORIGIN")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (configurados.includes("*")) {
    if (produccion)
      throw new Error("CORS_ORIGIN=* no está permitido en producción: lista los orígenes");
    return ["*"];
  }
  if (!configurados.length && !produccion) return ["*"];

  const propios = ["VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL", "VERCEL_BRANCH_URL"]
    .map(texto)
    .filter(Boolean);
  return [...new Set([...configurados, ...propios].map(normalizarOrigen))];
}

export type Env = ReturnType<typeof validarEnv>;
