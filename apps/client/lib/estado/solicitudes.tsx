import type { Solicitud, SolicitudInput } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { Alert, Platform } from "react-native";
import { escucharSolicitudes, solicitudes as solicitudesApi } from "@/api";
import { useAcciones, useInventario } from "./inventario";
import { useSesion } from "./sesion";

const SIN_SOLICITUDES: Solicitud[] = [];

/**
 * Pedidos de los lectores (agregar, eliminar o cambiar stock) del inventario
 * abierto. Owner y editores ven todos y los resuelven; un lector ve los suyos.
 * Al owner y a los editores les avisa en vivo cuando llega uno nuevo.
 */
function useEstadoSolicitudes() {
  const qc = useQueryClient();
  const { usuario, enVivo } = useSesion();
  const { activo, permisos, productosActivos } = useInventario();
  const { eliminarProducto, ajustarStock } = useAcciones();
  const uid = usuario?.id;
  const invId = activo?.id;
  const resuelvo = permisos.editar_productos;

  const q = useQuery({
    queryKey: ["solicitudes", invId],
    enabled: !!invId && !!uid,
    queryFn: () => solicitudesApi.pendientes(invId!),
  });
  const refrescar = useCallback(
    () => qc.invalidateQueries({ queryKey: ["solicitudes", invId] }),
    [qc, invId],
  );

  // Lo que necesita el aviso, sin reconectar el canal cada vez que cambia.
  const vivo = useRef({ activo, productosActivos, resuelvo, uid });
  useEffect(() => {
    vivo.current = { activo, productosActivos, resuelvo, uid };
  });

  useEffect(() => {
    if (!invId || !uid || !enVivo) return;
    return escucharSolicitudes(invId, {
      creada: (s) => {
        void refrescar();
        const v = vivo.current;
        if (!v.resuelvo || s.creado_por === v.uid) return;
        const quien =
          v.activo?.miembros.find((m) => m.usuario_id === s.creado_por)?.nombre ?? "Alguien";
        const producto =
          v.productosActivos.find((p) => p.id === s.producto_id)?.nombre ?? "un producto";
        const texto =
          s.tipo === "agregar"
            ? `${quien} pide agregar “${s.detalle}”.`
            : s.tipo === "eliminar"
              ? `${quien} pide eliminar “${producto}”.`
              : `${quien} pide poner ${s.cantidad} de “${producto}”.`;
        if (Platform.OS === "web") window.alert(`Nueva solicitud\n\n${texto}`);
        else Alert.alert("Nueva solicitud", `${texto} La ves arriba en el inventario.`);
      },
      cambiaron: () => void refrescar(),
    });
  }, [invId, uid, enVivo, refrescar]);

  const lista = q.data ?? SIN_SOLICITUDES;
  const visibles = useMemo(
    () => (resuelvo ? lista : lista.filter((s) => s.creado_por === uid)),
    [lista, resuelvo, uid],
  );

  const acciones = useMemo(
    () => ({
      /** Un lector le pide algo a quien edita el inventario. */
      async pedir(input: SolicitudInput) {
        if (!invId) throw new Error("No hay inventario abierto.");
        await solicitudesApi.crear(invId, input);
        await refrescar();
      },
      async retirar(id: string) {
        await solicitudesApi.retirar(id);
        await refrescar();
      },
      /**
       * Owner o editor: acepta (y hace el cambio) o rechaza. "agregar" solo se
       * marca aceptada: el producto lo termina de cargar quien acepta.
       */
      async resolver(s: Solicitud, aceptar: boolean) {
        if (aceptar && s.producto_id) {
          if (s.tipo === "eliminar") await eliminarProducto(s.producto_id);
          if (s.tipo === "stock" && s.cantidad !== null)
            await ajustarStock(s.producto_id, s.cantidad);
        }
        await solicitudesApi.resolver(s.id, aceptar ? "aceptada" : "rechazada");
        await refrescar();
      },
    }),
    [invId, refrescar, eliminarProducto, ajustarStock],
  );

  return useMemo(
    () => ({
      /** Pendientes: todas para owner y editores; las mías para un lector. */
      solicitudes: visibles,
      /** Cuántas me toca resolver (para la insignia de la pestaña). */
      porResolver: resuelvo ? lista.length : 0,
      resuelvo,
      ...acciones,
    }),
    [visibles, lista.length, resuelvo, acciones],
  );
}

type Estado = ReturnType<typeof useEstadoSolicitudes>;
const Contexto = createContext<Estado | null>(null);

export function SolicitudesProvider({ children }: { children: React.ReactNode }) {
  const valor = useEstadoSolicitudes();
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSolicitudes() {
  const valor = useContext(Contexto);
  if (!valor) throw new Error("useSolicitudes fuera de <SolicitudesProvider>");
  return valor;
}
