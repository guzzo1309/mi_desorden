import Constants from "expo-constants";
import { NativeModules } from "react-native";
import { ambienteDe, apiLocalDesde, resolverApiUrl } from "./permitidas";

/** Ambiente de la app. Doppler: development (dev, dev_personal), staging (stg), production (prd). */
const ambiente = ambienteDe(process.env.EXPO_PUBLIC_APP_ENV);

/**
 * Host de la Mac que sirve Metro. En Expo Go viene en hostUri; en el dev build suele
 * venir vacío, así que se saca de la URL del bundle (http://192.168.x.x:8081/index.bundle…).
 */
function hostDeMetro(): string | undefined {
  const fuente = NativeModules.SourceCode as
    | { scriptURL?: string; getConstants?: () => { scriptURL?: string } }
    | undefined;
  return (
    Constants.expoConfig?.hostUri ||
    fuente?.getConstants?.().scriptURL ||
    fuente?.scriptURL ||
    undefined
  );
}

/** Variables públicas del backend. Vienen de Doppler (o del .env con `dev:local`). */
export const config = {
  ambiente,
  /** Validada contra la lista blanca de api/permitidas.ts. */
  apiUrl: resolverApiUrl(
    ambiente,
    process.env.EXPO_PUBLIC_API_URL ||
      // Desarrollo sin URL fija: la de la Mac que sirve Metro (sirve en el teléfono).
      (ambiente === "development" ? apiLocalDesde(hostDeMetro()) : undefined),
  ),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? "",
};

if (__DEV__) {
  console.log(
    `[api] ${config.ambiente} → ${config.apiUrl}`,
    `(Metro: ${hostDeMetro() ?? "—"}, EXPO_PUBLIC_API_URL: ${process.env.EXPO_PUBLIC_API_URL || "—"})`,
  );
}

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
