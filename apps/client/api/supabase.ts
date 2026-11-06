import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { config } from "./config";

/**
 * fetch sin caché: iOS (URLSession) guarda los GET que vienen sin encabezados
 * de caché y los reusa, así que "refrescar" devolvía la lista vieja (por
 * ejemplo, el inventario recién creado no aparecía hasta recargar la app).
 */
const fetchSinCache = (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-cache");
  headers.set("Pragma", "no-cache");
  return fetch(entrada, { ...init, headers, cache: "no-store" });
};

/** Cliente de Supabase. Uso interno de la carpeta api/: el resto de la app no lo importa. */
export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    // En web la sesión va en localStorage (default); en el teléfono, AsyncStorage.
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // Implícito, no PKCE: con PKCE Supabase ata el código del correo al flujo y
    // el código de 8 dígitos escrito a mano siempre da "inválido". El enlace
    // vuelve con la sesión en el fragmento (ver auth.completarDesdeEnlace).
    flowType: "implicit",
  },
  global: { fetch: fetchSinCache as typeof fetch },
});

// Refresca el token solo con la app en primer plano (recomendado por Supabase para RN).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (estado) => {
    if (estado === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
