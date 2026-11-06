import type { Movimiento, TipoMovimiento } from "@mi-desorden/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { mensajeError, movimientos, PAGINA_MOVIMIENTOS } from "@/api";
import { BotonCabecera, BotonPrincipal, Contenido, IconoCelda, Vacio } from "@/components/ui";
import { Separador, Tarjeta } from "@/components/vistas";
import { agruparPorDia, textoMovimiento } from "@/lib/historial";
import { useInventario, useSesion } from "@/lib/store";
import { tipo as tipografia, useTema } from "@/lib/theme";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });

/** Ícono y color de cada tipo de movimiento. */
function marca(tipo: TipoMovimiento, t: ReturnType<typeof useTema>) {
  switch (tipo) {
    case "creado":
      return { sf: "plus" as const, ion: "add" as const, fondo: t.verde };
    case "stock":
      return { sf: "arrow.up.arrow.down" as const, ion: "swap-vertical" as const, fondo: t.tinte };
    case "editado":
      return { sf: "pencil" as const, ion: "pencil" as const, fondo: t.azul };
    case "eliminado":
      return { sf: "trash.fill" as const, ion: "trash" as const, fondo: t.rojo };
  }
}

function Renglon({ m, yoId }: { m: Movimiento; yoId?: string }) {
  const t = useTema();
  const { titulo, detalle } = textoMovimiento(m, yoId);
  const { sf, ion, fondo } = marca(m.tipo, t);
  return (
    <View
      style={s.fila}
      accessible
      accessibilityLabel={`${titulo}. ${detalle}. ${hora(m.creado_en)}`}
    >
      <IconoCelda sf={sf} ion={ion} fondo={fondo} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[tipografia.cuerpo, { color: t.texto }]}>{titulo}</Text>
        {detalle ? <Text style={[tipografia.nota, { color: t.textoSec }]}>{detalle}</Text> : null}
      </View>
      <Text style={[tipografia.nota, { color: t.textoTer }]}>{hora(m.creado_en)}</Text>
    </View>
  );
}

/** Quién hizo qué en el inventario activo. Solo para el owner. */
export default function Historial() {
  const t = useTema();
  const { activo, permisos } = useInventario();
  const { usuario } = useSesion();
  const puedeVer = !!activo && permisos.gestionar_accesos;

  const q = useInfiniteQuery({
    queryKey: ["historial", activo?.id],
    enabled: puedeVer,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => movimientos.listar(activo!.id, pageParam),
    getNextPageParam: (ultima) =>
      ultima.length === PAGINA_MOVIMIENTOS ? ultima[ultima.length - 1]!.id : undefined,
  });

  const grupos = useMemo(() => agruparPorDia((q.data?.pages ?? []).flat()), [q.data]);

  return (
    <>
      <Stack.Screen
        options={{
          title: "Historial",
          headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => void q.refetch()}
            tintColor={t.textoSec}
          />
        }
      >
        {!puedeVer ? (
          <Vacio
            sf="lock"
            ion="lock-closed-outline"
            titulo="Solo el owner"
            texto="El historial de movimientos lo ve únicamente el owner del inventario."
          />
        ) : null}

        {puedeVer && q.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
        {puedeVer && q.error && !q.data ? (
          <Vacio
            sf="wifi.exclamationmark"
            ion="cloud-offline-outline"
            titulo="No se pudo cargar"
            texto={mensajeError(q.error)}
          />
        ) : null}

        {puedeVer && q.data && !grupos.length ? (
          <Vacio
            sf="clock.arrow.circlepath"
            ion="time-outline"
            titulo="Todavía no hay movimientos"
            texto="Aquí vas a ver quién agrega, ajusta, edita o elimina productos, desde ahora."
          />
        ) : null}

        {grupos.map((g) => (
          <View key={g.dia} style={{ gap: 6 }}>
            <Text style={[tipografia.nota, s.dia, { color: t.textoSec }]}>
              {g.dia.toUpperCase()}
            </Text>
            <Tarjeta>
              {g.items.map((m, i) => (
                <View key={m.id}>
                  {i > 0 ? <Separador sangria={60} /> : null}
                  <Renglon m={m} yoId={usuario?.id} />
                </View>
              ))}
            </Tarjeta>
          </View>
        ))}

        {q.hasNextPage ? (
          <BotonPrincipal
            variante="gris"
            cargando={q.isFetchingNextPage}
            onPress={() => void q.fetchNextPage()}
          >
            Cargar más
          </BotonPrincipal>
        ) : null}
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  dia: { paddingHorizontal: 16, letterSpacing: 0.4 },
});
