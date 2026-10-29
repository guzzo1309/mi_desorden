import type { Usuario } from "@mi-desorden/core";
import type { Session } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import { leerEnlace } from "./enlace";
import { mensajeError, siFalla } from "./errores";
import { supabase } from "./supabase";

const normalizar = (email: string) => email.trim().toLowerCase();

/**
 * A dónde vuelve el enlace del correo de confirmación. En el development build
 * es `midesorden://callback`; en Expo Go, `exp://<ip>:8081/--/callback`.
 * Tiene que estar en Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export const urlRetorno = () => Linking.createURL("callback");

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
      options: { data: { nombre: nombre.trim() }, emailRedirectTo: urlRetorno() },
    });
    siFalla(error);
    return !data.session;
  },

  /** Vuelve a mandar el correo de confirmación (Supabase limita a uno por minuto). */
  async reenviarConfirmacion(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizar(email),
      options: { emailRedirectTo: urlRetorno() },
    });
    siFalla(error);
  },

  /** Confirma la cuenta con el código del correo (6 a 10 dígitos, según Supabase) e inicia la sesión. */
  async confirmarConCodigo(email: string, codigo: string) {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizar(email),
      token: codigo.replace(/\D/g, ""),
      type: "email",
    });
    siFalla(error);
  },

  /**
   * El enlace del correo volvió a la app: guarda la sesión que trae en el
   * fragmento (#access_token=…). Si Supabase mandó un error, lo tira.
   */
  async completarDesdeEnlace(url: string) {
    const d = leerEnlace(url);
    if (d.error_description || d.error_code) {
      throw new Error(mensajeError(d.error_description ?? d.error_code));
    }
    if (d.access_token && d.refresh_token) {
      const { error } = await supabase.auth.setSession({
        access_token: d.access_token,
        refresh_token: d.refresh_token,
      });
      siFalla(error);
      return d.type;
    }
    // Enlaces viejos, de cuando el cliente usaba PKCE.
    if (d.code) {
      const { error } = await supabase.auth.exchangeCodeForSession(d.code);
      siFalla(error);
      return d.type;
    }
    throw new Error("El enlace no trae los datos de la cuenta. Pide otro correo o usa el código.");
  },

  /**
   * Manda el correo para recuperar la contraseña (código + enlace). Supabase
   * responde igual exista o no la cuenta, así no se puede averiguar quién está registrado.
   */
  async enviarRecuperacion(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizar(email), {
      redirectTo: urlRetorno(),
    });
    siFalla(error);
  },

  /** Valida el código de recuperación. Ojo: deja la sesión iniciada (ver store.recuperando). */
  async verificarRecuperacion(email: string, codigo: string) {
    const { error } = await supabase.auth.verifyOtp({
      email: normalizar(email),
      token: codigo.replace(/\D/g, ""),
      type: "recovery",
    });
    siFalla(error);
  },

  /** Cambia la contraseña del usuario con sesión (después de verificar la recuperación). */
  async cambiarClave(nueva: string) {
    const { error } = await supabase.auth.updateUser({ password: nueva });
    siFalla(error);
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

  /**
   * ¿Mi cuenta todavía tiene la contraseña temporal que me puso el owner? Si la
   * función no existe o falla, se asume que no: nunca deja a nadie afuera.
   */
  async debeCambiarClave(): Promise<boolean> {
    const { data, error } = await supabase.rpc("debe_cambiar_clave");
    return !error && data === true;
  },

  /** Avisa a la base que ya cambié la contraseña temporal. Falla si todavía es la misma. */
  async claveCambiada() {
    const { error } = await supabase.rpc("clave_cambiada");
    siFalla(error);
  },
};
