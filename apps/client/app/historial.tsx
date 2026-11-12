import type { Movimiento, TipoMovimiento } from "@mi-desorden/core";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { mensajeError, movimientos, PAGINA_MOVIMIENTOS } from "@/api";
import { BarraBusqueda } from "@/components/BarraBusqueda";
import { BotonCabecera, BotonPrincipal, Contenido, Icono, Vacio } from "@/components/ui";
import { Separador, Tarjeta } from "@/components/vistas";
import { agruparPorDia, horaAmPm, renglonMovimiento } from "@/lib/historial";
import { useInventario, useSesion } from "@/lib/store";
import { fuenteMarca, tipo as tipografia, useTema } from "@/lib/theme";

/** Espera tras la última tecla antes de buscar en el servidor. */
const ESPERA_BUSQUEDA = 300;

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

/** Lo que mide el círculo del ícono (y de dónde arranca el separador). */
const ICONO = 34;
const RELLENO = 14;

function Renglon({ m, yoId }: { m: Movimiento; yoId?: string }) {
  const t = useTema();
  const { producto, accion, cifra, cambios } = renglonMovimiento(m, yoId);
  const { sf, ion, fondo } = marca(m.tipo, t);
  const colorCifra =
    cifra?.tono === "sube" ? t.verde : cifra?.tono === "baja" ? t.rojo : t.textoSec;
  return (
    <View
      style={s.fila}
      accessible
      accessibilityLabel={[producto, accion, ...cambios, cifra?.texto, horaAmPm(m.creado_en)]
        .filter(Boolean)
        .join(". ")}
    >
      <View style={[s.icono, { backgroundColor: `${fondo}1F` }]}>
        <Icono sf={sf} ion={ion} size={15} color={fondo} weight="semibold" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[tipografia.destacado, { color: t.texto }]} numberOfLines={2}>
          {producto}
        </Text>
        <Text style={[tipografia.nota, { color: t.textoSec }]} numberOfLines={1}>
          {accion}
        </Text>
        {cambios.map((c) => (
          <Text key={c} style={[tipografia.nota, { color: t.textoSec }]} numberOfLines={2}>
            {c}
          </Text>
        ))}
      </View>
      <View style={s.derecha}>
        {cifra ? <Text style={[s.cifra, { color: colorCifra }]}>{cifra.texto}</Text> : null}
        <Text style={[tipografia.leyenda, { color: t.textoTer, fontVariant: ["tabular-nums"] }]}>
          {horaAmPm(m.creado_en)}
        </Text>
      </View>
    </View>
  );
}

/** Quién hizo qué en el inventario activo. Solo para el owner. */
export default function Historial() {
  const t = useTema();
  const { activo, permisos } = useInventario();
  const { usuario } = useSesion();
  const puedeVer = !!activo && permisos.gestionar_accesos;
  const [busqueda, setBusqueda] = useState("");
  const [buscar, setBuscar] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setBuscar(busqueda.trim()), ESPERA_BUSQUEDA);
    return () => clearTimeout(id);
  }, [busqueda]);

  const q = useInfiniteQuery({
    queryKey: ["historial", activo?.id, buscar],
    enabled: puedeVer,
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) => movimientos.listar(activo!.id, pageParam, buscar),
    // Mientras busca, se siguen viendo los resultados anteriores (no parpadea).
    placeholderData: (previo) => previo,
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

        {puedeVer ? (
          <BarraBusqueda valor={busqueda} onCambio={setBusqueda} placeholder="Buscar un producto" />
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

        {puedeVer && q.data && !grupos.length && buscar ? (
          <Vacio
            sf="magnifyingglass"
            ion="search"
            titulo="Sin resultados"
            texto={`No hay movimientos de productos con “${buscar}”.`}
          />
        ) : null}

        {puedeVer && q.data && !grupos.length && !buscar ? (
          <Vacio
            sf="clock.arrow.circlepath"
            ion="time-outline"
            titulo="Todavía no hay movimientos"
            texto="Aquí vas a ver quién agrega, ajusta, edita o elimina productos, desde ahora."
          />
        ) : null}

        {grupos.map((g) => (
          <View key={g.dia} style={{ gap: 6 }}>
            <Text
              style={[tipografia.titulo3, s.dia, { color: t.texto }]}
              accessibilityRole="header"
            >
              {g.dia.charAt(0).toUpperCase() + g.dia.slice(1)}
            </Text>
            <Tarjeta>
              {g.items.map((m, i) => (
                <View key={m.id}>
                  {i > 0 ? <Separador sangria={RELLENO + ICONO + 12} /> : null}
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
  fila: { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: RELLENO },
  icono: {
    width: ICONO,
    height: ICONO,
    borderRadius: ICONO / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  derecha: { alignItems: "flex-end", gap: 2, paddingTop: 1 },
  cifra: {
    fontSize: 17,
    fontWeight: "700",
    fontFamily: fuenteMarca,
    fontVariant: ["tabular-nums"],
  },
  dia: { paddingHorizontal: 4, marginTop: 4 },
});
