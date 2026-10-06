import { router, Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FilaProducto } from "@/components/FilaProducto";
import {
  BotonPrincipal,
  CampoFila,
  Contenido,
  Grupo,
  Icono,
  Pildora,
  Segmentado,
  tocar,
  Vacio,
} from "@/components/ui";
import { haceCuanto } from "@/lib/fecha";
import { mensajeError } from "@/api";
import { puedeEditar, useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

type Filtro = "todos" | "reponer" | "agotados";

export default function Inventario() {
  const t = useTema();
  const {
    inventarios,
    activo,
    productosActivos,
    seleccionarInventario,
    enVivo,
    miRol,
    cargando,
    errorCarga,
    refrescando,
    refrescar,
  } = useStore();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  // Re-render cada 15 s para que "hace X min" no quede viejo.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productosActivos
      .filter(
        (p) => !q || [p.nombre, p.categoria, p.ubicacion].some((c) => c.toLowerCase().includes(q)),
      )
      .filter((p) =>
        filtro === "reponer"
          ? p.cantidad < p.minimo
          : filtro === "agotados"
            ? p.cantidad === 0
            : true,
      )
      .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
  }, [productosActivos, busqueda, filtro]);

  const resumen = useMemo(() => {
    const unidades = productosActivos.reduce((a, p) => a + p.cantidad, 0);
    const reponer = productosActivos.filter((p) => p.cantidad < p.minimo).length;
    const ultima = productosActivos
      .map((p) => p.actualizado_en)
      .sort()
      .at(-1);
    return { unidades, reponer, ultima };
  }, [productosActivos]);

  const editable = puedeEditar(miRol);

  return (
    <>
      <Stack.Screen
        options={{
          title: activo?.nombre ?? "Inventario",
          headerRight:
            editable && activo
              ? () => (
                  <Pressable
                    accessibilityLabel="Agregar producto"
                    hitSlop={10}
                    onPress={() => (tocar(), router.push("/producto"))}
                    style={s.botonHeader}
                  >
                    <Icono sf="plus" ion="add" size={22} color={t.tinte} weight="semibold" />
                  </Pressable>
                )
              : undefined,
          headerSearchBarOptions:
            Platform.OS === "web"
              ? undefined
              : {
                  placeholder: "Buscar productos",
                  onChangeText: (e) => setBusqueda(e.nativeEvent.text),
                  onCancelButtonPress: () => setBusqueda(""),
                  hideWhenScrolling: true,
                  tintColor: t.tinte,
                },
        }}
      />
      <Contenido
        refreshControl={
          <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={t.textoSec} />
        }
      >
        {cargando ? <ActivityIndicator style={{ marginTop: 48 }} /> : null}
        {!cargando && errorCarga ? (
          <Vacio
            sf="wifi.exclamationmark"
            ion="cloud-offline-outline"
            titulo="No se pudo cargar"
            texto={mensajeError(errorCarga)}
          />
        ) : null}
        {!cargando && !errorCarga && !activo ? (
          <>
            <Vacio
              sf="shippingbox"
              ion="cube-outline"
              titulo="Todavía no tenés inventarios"
              texto="Creá uno para empezar a cargar productos, o pedile a alguien que te dé acceso al suyo."
            />
            <BotonPrincipal onPress={() => router.push("/inventario-nuevo")}>
              Crear inventario
            </BotonPrincipal>
          </>
        ) : null}
        {activo ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.carrusel}
              contentContainerStyle={s.pildoras}
            >
              {inventarios.map((inv) => (
                <Pildora
                  key={inv.id}
                  activa={inv.id === activo?.id}
                  onPress={() => seleccionarInventario(inv.id)}
                >
                  {inv.nombre}
                </Pildora>
              ))}
              <Pildora onPress={() => router.push("/inventario-nuevo")}>＋ Nuevo</Pildora>
            </ScrollView>

            <View style={[s.resumen, { backgroundColor: t.celda }]}>
              <Dato valor={productosActivos.length} etiqueta="Productos" />
              <View style={[s.divisor, { backgroundColor: t.separador }]} />
              <Dato valor={resumen.unidades} etiqueta="Unidades" />
              <View style={[s.divisor, { backgroundColor: t.separador }]} />
              <Dato
                valor={resumen.reponer}
                etiqueta="Por reponer"
                color={resumen.reponer ? t.tinte : undefined}
              />
            </View>

            <View style={s.estado}>
              <View style={[s.punto, { backgroundColor: enVivo ? t.verde : t.textoTer }]} />
              <Text style={[tipo.nota, { color: t.textoSec }]}>
                {enVivo ? "En vivo" : "Actualización en vivo pausada"}
                {resumen.ultima ? ` · ${haceCuanto(resumen.ultima)}` : ""}
              </Text>
            </View>

            {Platform.OS === "web" ? (
              <Grupo>
                <CampoFila
                  placeholder="Buscar productos"
                  value={busqueda}
                  onChangeText={setBusqueda}
                />
              </Grupo>
            ) : null}

            <Segmentado<Filtro>
              valor={filtro}
              onCambio={setFiltro}
              opciones={[
                { valor: "todos", etiqueta: "Todos" },
                { valor: "reponer", etiqueta: "Por reponer" },
                { valor: "agotados", etiqueta: "Agotados" },
              ]}
            />

            {lista.length ? (
              <Grupo sangria={42} pie={`${lista.length} de ${productosActivos.length} productos`}>
                {lista.map((p) => (
                  <FilaProducto
                    key={p.id}
                    producto={p}
                    onPress={() => router.push({ pathname: "/producto", params: { id: p.id } })}
                  />
                ))}
              </Grupo>
            ) : (
              <Vacio
                sf={busqueda || filtro !== "todos" ? "magnifyingglass" : "shippingbox"}
                ion={busqueda || filtro !== "todos" ? "search" : "cube-outline"}
                titulo={busqueda || filtro !== "todos" ? "Sin resultados" : "Inventario vacío"}
                texto={
                  busqueda || filtro !== "todos"
                    ? "Probá con otra búsqueda o cambiá el filtro."
                    : "Agregá un producto con ＋ o apuntá la cámara a la estantería."
                }
              />
            )}
          </>
        ) : null}
      </Contenido>
    </>
  );
}

function Dato({ valor, etiqueta, color }: { valor: number; etiqueta: string; color?: string }) {
  const t = useTema();
  return (
    <View style={s.dato}>
      <Text
        style={[tipo.titulo2, { color: color ?? t.texto, fontVariant: ["tabular-nums"] }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </Text>
      <Text style={[tipo.leyenda, { color: t.textoSec }]} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  botonHeader: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  carrusel: { marginHorizontal: -16, flexGrow: 0 },
  pildoras: { gap: 8, paddingHorizontal: 16 },
  resumen: { flexDirection: "row", borderRadius: 26, paddingVertical: 16 },
  dato: { flex: 1, alignItems: "center", gap: 2, paddingHorizontal: 4 },
  divisor: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  estado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -12,
    paddingHorizontal: 16,
  },
  punto: { width: 7, height: 7, borderRadius: 4 },
});
