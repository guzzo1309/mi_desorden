import type { Usuario } from "@mi-desorden/core";
import type { Session } from "@supabase/supabase-js";
import { siFalla } from "./errores";
import { supabase } from "./supabase";

const normalizar = (email: string) => email.trim().toLowerCase();

function aUsuario(s: Session | null): Usuario | null {
  if (!s) return null;
  const email = s.user.email ?? "";
  return {
    id: s.user.id,
    email,
    nombre: (s.user.user_metadata?.nombre as string | undefined) || email.split("@")[0] || "Yo",
    creado_en: s.user.created_at,
  };
}

export const auth = {
  async usuarioActual(): Promise<Usuario | null> {
    const { data } = await supabase.auth.getSession();
    return aUsuario(data.session);
  },

  /** Access token para la API de Nest (lo usa http.ts). */
  async token(): Promise<string | undefined> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  },

  /** Avisa cada vez que cambia la sesión. Devuelve la función para dejar de escuchar. */
  alCambiar(fn: (usuario: Usuario | null, cerro: boolean) => void) {
    const { data } = supabase.auth.onAuthStateChange((evento, s) =>
      fn(aUsuario(s), evento === "SIGNED_OUT"),
    );
    return () => data.subscription.unsubscribe();
  },

  /** Devuelve true si Supabase pide confirmar el correo antes de entrar. */
  async registrar(nombre: string, email: string, clave: string) {
    const { data, error } = await supabase.auth.signUp({
      email: normalizar(email),
      password: clave,
      options: { data: { nombre: nombre.trim() } },
    });
    siFalla(error);
    return !data.session;
  },

  async iniciarSesion(email: string, clave: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizar(email),
      password: clave,
    });
    siFalla(error);
  },

  async cerrarSesion() {
    await supabase.auth.signOut();
  },
};
