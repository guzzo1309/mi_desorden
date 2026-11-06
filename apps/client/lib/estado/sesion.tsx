import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Usuario } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { admin as adminApi, auth } from "@/api";

/**
 * Sesión y preferencias del dispositivo: quién soy, si soy admin, qué inventario
 * tengo abierto y si la actualización en vivo está prendida. Cambia poco, así que
 * las pantallas que solo necesitan esto (login, layout raíz) no se vuelven a
 * dibujar con cada cambio de productos o de presencia.
 */

const CLAVE_ACTIVO = "mi_desorden:activo";
const CLAVE_VIVO = "mi_desorden:en-vivo";

function useEstadoSesion() {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);
  const [activoId, setActivoId] = useState<string | null>(null);
  const [enVivo, setEnVivoState] = useState(true);
  /**
   * Recuperando la contraseña: verificar el código ya inicia la sesión, pero
   * hasta que se guarde la clave nueva hay que quedarse en la pantalla de
   * recuperación. Mientras esto está prendido, el layout no deja pasar a las tabs.
   */
  const [recuperando, setRecuperando] = useState(false);

  // Sesión + preferencias guardadas.
  useEffect(() => {
    Promise.all([
      auth.usuarioActual().then(setUsuario),
      AsyncStorage.multiGet([CLAVE_ACTIVO, CLAVE_VIVO])
        .then(([[, activo], [, vivo]]) => {
          if (activo) setActivoId(activo);
          if (vivo) setEnVivoState(vivo === "1");
        })
        .catch(() => {}),
    ]).finally(() => setListo(true));

    return auth.alCambiar((u, cerro) => {
      setUsuario(u);
      if (cerro) qc.clear();
    });
  }, [qc]);

  const uid = usuario?.id;

  // ¿Admin de la plataforma? Decide qué pestañas se ven; la base valida cada consulta.
  const adminQ = useQuery({
    queryKey: ["esAdmin", uid],
    enabled: !!uid,
    queryFn: adminApi.esAdmin,
    staleTime: Infinity,
    retry: false,
  });

  // ¿Entró con la contraseña temporal que le puso el owner? Hasta cambiarla no pasa a la app.
  const claveQ = useQuery({
    queryKey: ["debeCambiarClave", uid],
    enabled: !!uid,
    queryFn: auth.debeCambiarClave,
    staleTime: Infinity,
    retry: false,
  });

  const seleccionarInventario = useCallback((invId: string) => {
    setActivoId(invId);
    AsyncStorage.setItem(CLAVE_ACTIVO, invId).catch(() => {});
  }, []);

  /** El inventario activo ya no existe (se borró o se salió de él). */
  const olvidarActivo = useCallback(() => {
    setActivoId(null);
    AsyncStorage.removeItem(CLAVE_ACTIVO).catch(() => {});
  }, []);

  const setEnVivo = useCallback((valor: boolean) => {
    setEnVivoState(valor);
    AsyncStorage.setItem(CLAVE_VIVO, valor ? "1" : "0").catch(() => {});
  }, []);

  /** El enlace del correo volvió a la app. Si es de recuperación, se queda a pedir la clave nueva. */
  const completarDesdeEnlace = useCallback(async (url: string) => {
    const recuperacion = /[#?&]type=recovery\b/.test(url);
    if (recuperacion) setRecuperando(true);
    try {
      return await auth.completarDesdeEnlace(url);
    } catch (e) {
      if (recuperacion) setRecuperando(false);
      throw e;
    }
  }, []);

  /** Código + clave nueva: verifica (inicia sesión) y cambia la clave antes de dejar pasar. */
  const restablecerClave = useCallback(async (email: string, codigo: string, nueva: string) => {
    setRecuperando(true);
    try {
      await auth.verificarRecuperacion(email, codigo);
    } catch (e) {
      setRecuperando(false);
      throw e;
    }
    // Si falla el cambio, la sesión queda abierta y la pantalla deja reintentar solo la clave.
    try {
      await auth.cambiarClave(nueva);
    } catch (e) {
      throw Object.assign(e as Error, { soloClave: true });
    }
    setRecuperando(false);
  }, []);

  /** Reintento o enlace del correo: ya hay sesión, solo falta la clave nueva. */
  const guardarClaveNueva = useCallback(async (nueva: string) => {
    await auth.cambiarClave(nueva);
    setRecuperando(false);
  }, []);

  /** Primer ingreso: la contraseña nueva reemplaza a la temporal y recién ahí se entra a la app. */
  const cambiarClaveInicial = useCallback(
    async (nueva: string) => {
      await auth.cambiarClave(nueva);
      await auth.claveCambiada();
      qc.setQueryData(["debeCambiarClave", uid], false);
    },
    [qc, uid],
  );

  /** Salir de la recuperación a mitad de camino: cierra la sesión que abrió el código. */
  const cancelarRecuperacion = useCallback(async () => {
    if (usuario) await auth.cerrarSesion();
    setRecuperando(false);
  }, [usuario]);

  return useMemo(
    () => ({
      listo,
      usuario,
      recuperando,
      esAdmin: adminQ.data === true,
      /** Todavía no se sabe si es admin: evita mostrar un instante las pestañas equivocadas. */
      cargandoRol: !!uid && adminQ.isLoading,
      /** Entró con la contraseña temporal del owner: tiene que elegir la suya. */
      debeCambiarClave: claveQ.data === true,
      /** Todavía no se sabe si debe cambiarla: evita mostrar la app un instante. */
      cargandoClave: !!uid && claveQ.isLoading,
      activoId,
      enVivo,
      setEnVivo,
      seleccionarInventario,
      olvidarActivo,

      registrar: auth.registrar,
      iniciarSesion: auth.iniciarSesion,
      cerrarSesion: auth.cerrarSesion,
      reenviarConfirmacion: auth.reenviarConfirmacion,
      confirmarConCodigo: auth.confirmarConCodigo,
      enviarRecuperacion: auth.enviarRecuperacion,
      completarDesdeEnlace,
      restablecerClave,
      guardarClaveNueva,
      cambiarClaveInicial,
      cancelarRecuperacion,
    }),
    [
      listo,
      usuario,
      recuperando,
      adminQ.data,
      adminQ.isLoading,
      claveQ.data,
      claveQ.isLoading,
      uid,
      activoId,
      enVivo,
      setEnVivo,
      seleccionarInventario,
      olvidarActivo,
      completarDesdeEnlace,
      restablecerClave,
      guardarClaveNueva,
      cambiarClaveInicial,
      cancelarRecuperacion,
    ],
  );
}

const Contexto = createContext<ReturnType<typeof useEstadoSesion> | null>(null);

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const valor = useEstadoSesion();
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useSesion fuera de <SesionProvider>");
  return valor;
}
