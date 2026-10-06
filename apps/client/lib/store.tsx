import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Inventario, Producto, ProductoInput, Rol, Usuario } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  auth,
  escucharInventario,
  inventarios as inventariosApi,
  miembros,
  productos as productosApi,
} from "@/api";

/**
 * Estado de la app: sesión, inventario activo y caché (React Query).
 * No habla con el backend directamente: todo pasa por la carpeta api/.
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

  // La presencia llega por realtime; se mezcla acá con lo que trae la base.
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

  // Realtime del inventario activo.
  useEffect(() => {
    if (!activo || !uid || !enVivo) return;
    const invId = activo.id;
    const cortar = escucharInventario(invId, uid, {
      productoCreado: (p) => {
        ponerProducto(p);
        refrescarInventarios();
      },
      productoActualizado: ponerProducto,
      productoEliminado: (id) => {
        sacarProducto(invId, id);
        refrescarInventarios();
      },
      miembrosCambiaron: refrescarInventarios,
      presentes: setPresentes,
    });
    return () => {
      cortar();
      setPresentes(new Set());
    };
  }, [activo?.id, uid, enVivo, ponerProducto, sacarProducto, refrescarInventarios]);

  const acciones = {
    registrar: auth.registrar,
    iniciarSesion: auth.iniciarSesion,
    cerrarSesion: auth.cerrarSesion,

    seleccionarInventario(invId: string) {
      setActivoId(invId);
      AsyncStorage.setItem(CLAVE_ACTIVO, invId).catch(() => {});
    },

    async crearInventario(nombre: string, lugar: string) {
      const id = await inventariosApi.crear(nombre, lugar);
      await refrescarInventarios();
      acciones.seleccionarInventario(id);
    },

    async guardarProducto(productoId: string | null, input: ProductoInput) {
      if (productoId) {
        ponerProducto(await productosApi.actualizar(productoId, input));
      } else {
        ponerProducto(await productosApi.crear(activo!.id, input));
        refrescarInventarios();
      }
    },

    async eliminarProducto(productoId: string) {
      await productosApi.eliminar(productoId);
      if (activo) sacarProducto(activo.id, productoId);
      refrescarInventarios();
    },

    /** Lo que hace la cámara al reconocer un producto: lo marca como visto. */
    async confirmarDeteccion(productoId: string) {
      ponerProducto(await productosApi.marcarDetectado(productoId));
    },

    async invitar(invId: string, email: string, rol: Exclude<Rol, "dueño">) {
      await miembros.invitar(invId, email, rol);
      await refrescarInventarios();
    },

    async cambiarRol(invId: string, usuarioId: string, rol: Rol) {
      await miembros.cambiarRol(invId, usuarioId, rol);
      await refrescarInventarios();
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
      await Promise.all([inventariosQ.refetch(), productosQ.refetch()]);
    },
  };

  return {
    listo,
    usuario,
    inventarios,
    activo,
    miRol,
    enVivo,
    productosActivos: productosQ.data ?? [],
    cargando: inventariosQ.isLoading || (!!activo && productosQ.isLoading),
    errorCarga: inventariosQ.error ?? productosQ.error,
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
