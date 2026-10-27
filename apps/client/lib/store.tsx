import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  Categoria,
  Inventario,
  Producto,
  ProductoInput,
  Rol,
  Usuario,
} from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { olvidarHuella } from "@/lib/huellas";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  auth,
  categorias as categoriasApi,
  escucharInventario,
  escucharMisAccesos,
  inventarios as inventariosApi,
  miembros,
  productos as productosApi,
} from "@/api";

/**
- Estado de la app: sesión, inventario activo y caché (React Query).
- No habla con el backend directamente: todo pasa por la carpeta api/.
 */

const CLAVE_ACTIVO = "mi_desorden:activo";
const CLAVE_VIVO = "mi_desorden:en-vivo";

function useEstado() {
  const qc = useQueryClient();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);
  const [activoId, setActivoId] = useState<string | null>(null);
  const [enVivo, setEnVivoState] = useState(true);
  const [presentes, setPresentes] = useState<Set<string>>(new Set());

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
  const inventariosQ = useQuery({
    queryKey: ["inventarios", uid],
    enabled: !!uid,
    queryFn: inventariosApi.listar,
  });

  const inventarios: Inventario[] = useMemo(
    () =>
      (inventariosQ.data ?? []).map((inv) => ({
        ...inv,
        miembros: inv.miembros.map((m) => ({
          ...m,
          en_linea: m.usuario_id === uid || presentes.has(m.usuario_id),
        })),
      })),
    [inventariosQ.data, presentes, uid],
  );

  const activo = inventarios.find((i) => i.id === activoId) ?? inventarios[0] ?? null;
  const miRol: Rol = activo?.miembros.find((m) => m.usuario_id === uid)?.rol ?? "lector";

  const categoriasQ = useQuery({
    queryKey: ["categorias", activo?.id],
    enabled: !!activo,
    queryFn: () => categoriasApi.listar(activo!.id),
  });
  const refrescarCategorias = useCallback(
    (invId: string) => qc.invalidateQueries({ queryKey: ["categorias", invId] }),
    [qc],
  );

  const productosQ = useQuery({
    queryKey: ["productos", activo?.id],
    enabled: !!activo,
    queryFn: () => productosApi.listar(activo!.id),
  });

  const ponerProducto = useCallback(
    (p: Producto) =>
      qc.setQueryData<Producto[]>(["productos", p.inventario_id], (l) =>
        l
          ? l.some((x) => x.id === p.id)
            ? l.map((x) => (x.id === p.id ? p : x))
            : [...l, p]
          : [p],
      ),
    [qc],
  );
  const sacarProducto = useCallback(
    (inventarioId: string, id: string) =>
      qc.setQueryData<Producto[]>(["productos", inventarioId], (l) =>
        l?.filter((x) => x.id !== id),
      ),
    [qc],
  );
  const refrescarInventarios = useCallback(
    () => qc.invalidateQueries({ queryKey: ["inventarios", uid] }),
    [qc, uid],
  );

  useEffect(() => {
    if (!uid || !enVivo) return;
    return escucharMisAccesos(uid, () => void refrescarInventarios());
  }, [uid, enVivo, refrescarInventarios]);

  // Realtime del inventario activo y solicitudes
  useEffect(() => {
    if (!activo || !uid || !enVivo) return;
    const invId = activo.id;
    const esAdmin = puedeEditar(miRol);

    const opciones = {
      productoCreado: (p: Producto) => {
        ponerProducto(p);
        refrescarInventarios();
      },
      productoActualizado: ponerProducto,
      productoEliminado: (id: string) => {
        sacarProducto(invId, id);
        refrescarInventarios();
      },
      solicitudCreada: (s: any) => {
        if (esAdmin) {
          if (Platform.OS === 'web') {
            window.alert(`Nueva solicitud: ${s?.detalle ?? 'Solicitud de cambio'}`);
          } else {
            Alert.alert("Nueva Solicitud", s?.detalle ?? "Un usuario ha enviado una nueva solicitud.");
          }
        }
      },
      miembrosCambiaron: refrescarInventarios,
      categoriasCambiaron: () => void refrescarCategorias(invId),
      presentes: setPresentes,
    };

    const cortar = (escucharInventario as any)(invId, uid, opciones);
    return () => {
      cortar();
      setPresentes(new Set());
    };
  }, [
    activo?.id,
    uid,
    enVivo,
    miRol,
    ponerProducto,
    sacarProducto,
    refrescarInventarios,
    refrescarCategorias,
  ]);

  const sacarInventario = (invId: string) => {
    qc.setQueryData<Inventario[]>(["inventarios", uid], (l) => l?.filter((i) => i.id !== invId));
    qc.removeQueries({ queryKey: ["productos", invId] });
    if (activoId === invId || !activoId) {
      setActivoId(null);
      AsyncStorage.removeItem(CLAVE_ACTIVO).catch(() => {});
    }
    void refrescarInventarios();
  };

  const acciones = {
    registrar: auth.registrar,
    iniciarSesion: auth.iniciarSesion,
    cerrarSesion: auth.cerrarSesion,
    reenviarConfirmacion: auth.reenviarConfirmacion,
    confirmarConCodigo: auth.confirmarConCodigo,
    enviarRecuperacion: auth.enviarRecuperacion,

    async completarDesdeEnlace(url: string) {
      const recuperacion = /[#?&]type=recovery\b/.test(url);
      if (recuperacion) setRecuperando(true);
      try {
        return await auth.completarDesdeEnlace(url);
      } catch (e) {
        if (recuperacion) setRecuperando(false);
        throw e;
      }
    },

    async restablecerClave(email: string, codigo: string, nueva: string) {
      setRecuperando(true);
      try {
        await auth.verificarRecuperacion(email, codigo);
      } catch (e) {
        setRecuperando(false);
        throw e;
      }
      try {
        await auth.cambiarClave(nueva);
      } catch (e) {
        throw Object.assign(e as Error, { soloClave: true });
      }
      setRecuperando(false);
    },

    async guardarClaveNueva(nueva: string) {
      await auth.cambiarClave(nueva);
      setRecuperando(false);
    },

    async cancelarRecuperacion() {
      if (usuario) await auth.cerrarSesion();
      setRecuperando(false);
    },

    seleccionarInventario(invId: string) {
      setActivoId(invId);
      AsyncStorage.setItem(CLAVE_ACTIVO, invId).catch(() => {});
    },

    async crearInventario(nombre: string, lugar: string) {
      const id = await inventariosApi.crear(nombre, lugar);
      if (usuario) {
        const nuevo: Inventario = {
          id,
          nombre: nombre.trim(),
          lugar: lugar.trim(),
          creado_en: new Date().toISOString(),
          total_productos: 0,
          pendientes: [],
          miembros: [
            {
              usuario_id: usuario.id,
              rol: "dueño",
              nombre: usuario.nombre,
              email: usuario.email,
              en_linea: true,
            },
          ],
        };
        qc.setQueryData<Inventario[]>(["inventarios", uid], (l) =>
          l?.some((i) => i.id === id) ? l : [...(l ?? []), nuevo],
        );
      }
      acciones.seleccionarInventario(id);
      void refrescarInventarios();
    },

    async guardarProducto(productoId: string | null, input: ProductoInput): Promise<Producto> {
      if (productoId) {
        const p = await productosApi.actualizar(productoId, input);
        ponerProducto(p);
        return p;
      }
      const p = await productosApi.crear(activo!.id, input);
      ponerProducto(p);
      refrescarInventarios();
      return p;
    },

    async eliminarProducto(productoId: string) {
      const producto = productosQ.data?.find((p) => p.id === productoId);
      await productosApi.eliminar({ id: productoId, foto_path: producto?.foto_path ?? null });
      if (activo) sacarProducto(activo.id, productoId);
      refrescarInventarios();
    },

    async solicitarAlAdmin(productoId: string, mensaje: string) {
      if (!activo) throw new Error("No hay inventario activo.");
      const api = productosApi as Record<string, any>;
      if (typeof api.solicitarAccionAdmin === "function") {
        return await api.solicitarAccionAdmin(activo.id, productoId, mensaje);
      }
    },

    async subirFotoProducto(producto: Producto, base64: string) {
      ponerProducto(await productosApi.subirFoto(producto, base64));
      void olvidarHuella(producto.id);
      qc.invalidateQueries({
        queryKey: ["foto", producto.inventario_id + "/" + producto.id + ".jpg"],
      });
    },

    async quitarFotoProducto(producto: Producto) {
      ponerProducto(await productosApi.quitarFoto(producto));
      void olvidarHuella(producto.id);
    },

    async ajustarDesdeCamara(productoId: string, cantidad: number) {
      ponerProducto(await productosApi.ajustarDesdeCamara(productoId, cantidad));
    },

    async invitar(invId: string, email: string, rol: Exclude<Rol, "dueño">) {
      await miembros.invitar(invId, email, rol);
      await refrescarInventarios();
    },

    async invitarEnVarios(invIds: string[], email: string, rol: Exclude<Rol, "dueño">) {
      const resultados = await Promise.allSettled(
        invIds.map((id) => miembros.invitar(id, email, rol)),
      );
      const ok = invIds.filter((_, i) => resultados[i]!.status === "fulfilled");
      const error = resultados.find((r): r is PromiseRejectedResult => r.status === "rejected");
      const pendiente =
        ok.length > 0 &&
        resultados.every((r) => r.status !== "fulfilled" || r.value === "pendiente");
      const correo = ok.length
        ? await miembros
            .avisar(email, ok)
            .then(() => true)
            .catch(() => false)
        : false;
      await refrescarInventarios();
      return { ok, pendiente, correo, error: error ? (error.reason as Error) : null };
    },

    async cancelarInvitacion(invId: string, email: string) {
      await miembros.cancelarInvitacion(invId, email);
      await refrescarInventarios();
    },

    async crearCategoria(nombre: string, padreId: string | null): Promise<Categoria> {
      if (!activo) throw new Error("No hay inventario abierto.");
      const nueva = await categoriasApi.crear(activo.id, nombre, padreId);
      qc.setQueryData<Categoria[]>(["categorias", activo.id], (l) =>
        l?.some((c) => c.id === nueva.id) ? l : [...(l ?? []), nueva],
      );
      void refrescarCategorias(activo.id);
      return nueva;
    },

    async renombrarCategoria(id: string, nombre: string) {
      const c = await categoriasApi.renombrar(id, nombre);
      qc.setQueryData<Categoria[]>(["categorias", c.inventario_id], (l) =>
        l?.map((x) => (x.id === c.id ? c : x)),
      );
      void refrescarCategorias(c.inventario_id);
    },

    async eliminarCategoria(id: string) {
      if (!activo) return;
      await categoriasApi.eliminar(id);
      qc.setQueryData<Categoria[]>(["categorias", activo.id], (l) => l?.filter((c) => c.id !== id));
      void refrescarCategorias(activo.id);
    },

    async cambiarRol(invId: string, usuarioId: string, rol: Rol) {
      await miembros.cambiarRol(invId, usuarioId, rol);
      await refrescarInventarios();
    },

    async eliminarInventario(invId: string) {
      await inventariosApi.eliminar(invId);
      sacarInventario(invId);
    },

    async salirDeInventario(invId: string) {
      if (!uid) return;
      await miembros.quitar(invId, uid);
      sacarInventario(invId);
    },

    async quitarMiembro(invId: string, usuarioId: string) {
      await miembros.quitar(invId, usuarioId);
      await refrescarInventarios();
    },

    setEnVivo(valor: boolean) {
      setEnVivoState(valor);
      AsyncStorage.setItem(CLAVE_VIVO, valor ? "1" : "0").catch(() => {});
    },

    async refrescar() {
      await Promise.all([inventariosQ.refetch(), productosQ.refetch(), categoriasQ.refetch()]);
    },
  };

  return {
    listo,
    usuario,
    recuperando,
    inventarios,
    activo,
    miRol,
    enVivo,
    productosActivos: productosQ.data ?? [],
    categoriasActivas: categoriasQ.data ?? [],
    cargando:
      inventariosQ.isLoading || (!!activo && (productosQ.isLoading || categoriasQ.isLoading)),
    errorCarga: inventariosQ.error ?? productosQ.error ?? categoriasQ.error,
    refrescando: inventariosQ.isRefetching || productosQ.isRefetching,
    ...acciones,
  };
}

type Store = ReturnType<typeof useEstado>;
const Contexto = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const store = useEstado();
  return <Contexto.Provider value={store}>{children}</Contexto.Provider>;
}

export function useStore() {
  const store = useContext(Contexto);
  if (!store) throw new Error("useStore fuera de <StoreProvider>");
  return store;
}

export const puedeEditar = (rol: Rol) => rol !== "lector";