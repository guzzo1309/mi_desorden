import { ambienteDe, resolverApiUrl } from "./permitidas";

/** Ambiente de la app. Doppler: development (dev, dev_personal), staging (stg), production (prd). */
const ambiente = ambienteDe(process.env.EXPO_PUBLIC_APP_ENV);

/** Variables públicas del backend. Vienen de Doppler (o del .env con `dev:local`). */
export const config = {
  ambiente,
  /** Validada contra la lista blanca de api/permitidas.ts. */
  apiUrl: resolverApiUrl(ambiente, process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
};

if (!config.supabaseUrl || !config.supabaseKey) {
  throw new Error(
    "Faltan EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_KEY: cargalas en Doppler (proyecto mi_desroden) o en apps/client/.env",
  );
}
if (!/^https:\/\//.test(config.supabaseUrl) && !/^http:\/\/localhost/.test(config.supabaseUrl)) {
  // No se imprime el valor: si es la cadena de Postgres, trae la contraseña.
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL tiene que ser la URL https del proyecto, no la cadena de conexión de Postgres",
  );
}
