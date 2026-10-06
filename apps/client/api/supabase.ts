import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import { config } from "./config";

/** Cliente de Supabase. Uso interno de la carpeta api/: el resto de la app no lo importa. */
export const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: {
    // En web la sesión va en localStorage (default); en el teléfono, AsyncStorage.
    ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Refresca el token solo con la app en primer plano (recomendado por Supabase para RN).
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (estado) => {
    if (estado === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
