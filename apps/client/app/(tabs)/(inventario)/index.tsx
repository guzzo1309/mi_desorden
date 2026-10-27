import { useEsAncho } from '@/lib/pantalla';
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mensajeError } from "@/api";
import { Carpeta } from "@/components/Carpeta";
import { FilaProducto, SANGRIA_FILA } from "@/components/FilaProducto";
import { MenuMas } from "@/components/menus";
import { BotonPrincipal, Icono, tocar, Vacio } from "@/components/ui";
import {
  BotonRedondo,
  Encabezado,
  SegmentadoAnimado,
  Separador,
  Tarjeta,
  useEntrada,
  useSelectorInventario,
  Vista,
} from "@/components/vistas";
import { armarArbol, rutaCategoria } from "@/lib/categorias";
import { haceCuanto } from "@/lib/fecha";
import { puedeEditar, useStore } from "@/lib/store";
import { useTema } from "@/lib/theme";

type Filtro = "todos" | "reponer" | "agotados";

export default function Inventario() {
  const esAncho = useEsAncho();
  const t = useTema();
  const {
    activo,
    productosActivos,
    categoriasActivas,
    enVivo,
    miRol,
    cargando,
    errorCarga,
    refrescando,
    refrescar,
  } = useStore();
  // Carpetas abiertas. Se recuerdan mientras la pantalla está montada.
  const [abiertas, setAbiertas] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setAbiertas((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const entrada = useEntrada(5);
  const elegirInventario = useSelectorInventario();

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
        (p) =>
          !q ||
          [p.nombre, rutaCategoria(categoriasActivas, p.categoria_id), p.ubicacion].some((c) =>
            c.toLowerCase().includes(q),
          ),
      )
      .filter((p) =>
        filtro === "reponer"
          ? p.cantidad < p.minimo
          : filtro === "agotados"
            ? p.cantidad === 0
            : true,
      )
      .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
  }, [productosActivos, categoriasActivas, busqueda, filtro]);

  const arbol = useMemo(
    () => armarArbol(categoriasActivas, productosActivos),
    [categoriasActivas, productosActivos],
  );

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
  const estado =
    (enVivo ? "En vivo" : "En vivo pausado") +
    (resumen.ultima ? ` · ${haceCuanto(resumen.ultima)}` : "");
  const filtrando = !!busqueda.trim() || filtro !== "todos";

  if (!cargando && !errorCarga && !activo) {
    return (
      <Vista>
        <Encabezado
          sobre={enVivo ? "En vivo" : "En vivo pausado"}
          punto={enVivo ? t.verde : "#8E8E93"}
          titulo="Inventario"
          accion={
            <BotonRedondo
              sf="plus"
              ion="add"
              etiqueta="Crear inventario"
              onPress={() => router.push("/inventario-nuevo")}
            />
          }
          style={entrada(0)}
        />
        <Vacio
          sf="shippingbox"
          ion="cube-outline"
          titulo="Todavía no tenés inventarios"
          texto="Creá uno para empezar a cargar productos, o pedile a alguien que te dé acceso al suyo."
        />
        <BotonPrincipal onPress={() => router.push("/inventario-nuevo")}>
          Crear inventario
        </BotonPrincipal>
      </Vista>
    );
  }

  return (
    <Vista
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={t.textoSec} />
      }
    >
      <Encabezado
        sobre={estado}
        punto={enVivo ? t.verde : "#8E8E93"}
        titulo={activo?.nombre ?? "Inventario"}
        alTocar={activo ? elegirInventario : undefined}
        accion={
          editable && activo ? (
            <MenuMas
              etiqueta="Agregar"
              grupos={[
                [
                  {
                    etiqueta: "Nuevo producto",
                    sf: "shippingbox",
                    // Sin categorías todavía: primero se crea una y sigue con el producto.
                    onPress: () =>
                      categoriasActivas.length
                        ? router.push("/producto")
                        : router.push({ pathname: "/categoria", params: { luego: "producto" } }),
                  },
                  {
                    etiqueta: "Nueva categoría",
                    sf: "folder.badge.plus",
                    onPress: () => router.push("/categoria"),
                  },
                ],
              ]}
            />
          ) : undefined
        }
        style={entrada(0)}
      />

      {cargando ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
      {!cargando && errorCarga ? (
        <Vacio
          sf="wifi.exclamationmark"
          ion="cloud-offline-outline"
          titulo="No se pudo cargar"
          texto={mensajeError(errorCarga)}
        />
      ) : null}

      {!cargando && !errorCarga && activo ? (
        <>
          {/* Resumen: unidades destacadas en naranja; "Por reponer" filtra */}
          <Animated.View style={[s.resumen, entrada(2)]}>
            <View
              style={[s.dato, s.datoDestacado, { backgroundColor: t.tinte, shadowColor: t.tinte }]}
            >
              <Text style={[s.datoValor, { color: "#fff" }]} numberOfLines={1} adjustsFontSizeToFit>
                {resumen.unidades}
              </Text>
              <Text style={[s.datoEtiqueta, { color: "#fff", fontWeight: "600" }]}>Unidades</Text>
            </View>
            <View style={[s.dato, { backgroundColor: t.celda }]}>
              <Text
                style={[s.datoValor, { color: t.texto }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {productosActivos.length}
              </Text>
              <Text style={[s.datoEtiqueta, { color: t.textoSec }]}>Productos</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Muestra solo los productos por reponer"
              onPress={() => (tocar(), setFiltro("reponer"))}
              style={({ pressed }) => [
                s.dato,
                { backgroundColor: t.celda, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text
                style={[s.datoValor, { color: resumen.reponer ? t.tinte : t.texto }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {resumen.reponer}
              </Text>
              <Text style={[s.datoEtiqueta, { color: t.textoSec }]} numberOfLines={1}>
                Por reponer
              </Text>
            </Pressable>
          </Animated.View>

          {/* Búsqueda y filtro */}
          <Animated.View style={[{ gap: 10 }, entrada(3)]}>
            <View style={[s.buscar, { backgroundColor: t.relleno }]}>
              <Icono sf="magnifyingglass" ion="search" size={17} color={t.textoSec} />
              <TextInput
                placeholder="Buscar productos, lugares…"
                placeholderTextColor={t.textoTer}
                value={busqueda}
                onChangeText={setBusqueda}
                clearButtonMode="while-editing"
                returnKeyType="search"
                selectionColor={t.tinte}
                style={[s.buscarInput, { color: t.texto }]}
              />
            </View>
            <SegmentadoAnimado<Filtro>
              valor={filtro}
              onCambio={setFiltro}
              opciones={[
                { valor: "todos", etiqueta: "Todos" },
                { valor: "reponer", etiqueta: "Por reponer" },
                { valor: "agotados", etiqueta: "Agotados" },
              ]}
            />
          </Animated.View>

          {/* Lista: buscando o filtrando, plana; si no, en carpetas por categoría. */}
          <Animated.View style={[{ gap: 12 }, entrada(4)]}>
            {filtrando ? (
              lista.length ? (
                <View style={{ gap: 6 }}>
                  <Tarjeta>
            <View style={esAncho ? { flexDirection: 'row', flexWrap: 'wrap', gap: 16 } : undefined}>
              {lista.map((p, i) => (
                <View key={p.id} style={esAncho ? { width: '31%' } : undefined}>
                  {i > 0 && !esAncho ? <Separador sangria={SANGRIA_FILA} /> : null}
                  <FilaProducto
                    producto={p}
                    categoria={rutaCategoria(categoriasActivas, p.categoria_id)}
                    onPress={() =>
                      router.push({ pathname: "/producto", params: { id: p.id } })
                    }
                  />
                </View>
              ))}
            </View>
            <Text style={[s.pie, { color: t.textoSec }]}>
              {lista.length} de {productosActivos.length} productos
            </Text>
          </Tarjeta>
                </View>
              ) : (
                <Vacio
                  sf="magnifyingglass"
                  ion="search"
                  titulo="Sin resultados"
                  texto="Probá con otra búsqueda o cambiá el filtro."
                />
              )
            ) : arbol.raices.length || arbol.sinCategoria.length ? (
              <>
                {arbol.raices.map((nodo) => (
                  <Carpeta
                    key={nodo.categoria.id}
                    nodo={nodo}
                    abiertas={abiertas}
                    alternar={alternar}
                    editable={editable}
                  />
                ))}
                {arbol.sinCategoria.length ? (
                  <View style={{ gap: 6 }}>
                    <Text style={[s.pie, { color: t.textoSec }]}>
                      Sin categoría{editable ? " · tocá uno para asignarle una" : ""}
                    </Text>
                    <Tarjeta>
                      {arbol.sinCategoria.map((p, i) => (
                        <View key={p.id}>
                          {i > 0 ? <Separador sangria={SANGRIA_FILA} /> : null}
                          <FilaProducto
                            producto={p}
                            onPress={() =>
                              router.push({ pathname: "/producto", params: { id: p.id } })
                            }
                          />
                        </View>
                      ))}
                    </Tarjeta>
                  </View>
                ) : null}
              </>
            ) : (
              <>
                <Vacio
                  sf="folder.badge.plus"
                  ion="folder-open-outline"
                  titulo="Empezá por las categorías"
                  texto={
                    editable
                      ? "Agrupá tus productos en carpetas, como Bebidas o Herramientas. Después agregás los productos adentro."
                      : "Todavía no hay categorías ni productos en este inventario."
                  }
                />
                {editable ? (
                  <BotonPrincipal
                    onPress={() =>
                      router.push({ pathname: "/categoria", params: { luego: "producto" } })
                    }
                  >
                    Crear categoría
                  </BotonPrincipal>
                ) : null}
              </>
            )}
          </Animated.View>
        </>
      ) : null}
    </Vista>
  );
}

const s = StyleSheet.create({
  resumen: { flexDirection: "row", gap: 8 },
  dato: {
    flex: 1,
    minWidth: 0,
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 2,
  },
  datoDestacado: {
    flex: 1.25,
    shadowOpacity: 0.25,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 6 },
  },
  datoValor: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  datoEtiqueta: { fontSize: 13 },
  buscar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  buscarInput: { flex: 1, minWidth: 0, fontSize: 17, letterSpacing: -0.4, paddingVertical: 0 },
  pie: { fontSize: 13, paddingHorizontal: 16 },
});
