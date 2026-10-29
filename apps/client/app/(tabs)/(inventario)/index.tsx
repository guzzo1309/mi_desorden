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
import { PlanUso } from "@/components/PlanUso";
import { MenuMas } from "@/components/menus";
import { PrimerosPasos } from "@/components/PrimerosPasos";
import { TarjetaRol } from "@/components/TarjetaRol";
import { BotonPrincipal, Icono, tocar, Vacio } from "@/components/ui";
import {
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
import { esPorReponer, porReponer, textoAvisoStock } from "@/lib/stock";
import { useLimitesInventario, useMiPlan } from "@/lib/miPlan";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

type Filtro = "todos" | "reponer" | "agotados";

export default function Inventario() {
  const t = useTema();
  const { enVivo, usuario } = useSesion();
  const {
    activo,
    miRol,
    productosActivos,
    categoriasActivas,
    permisos,
    porRevisar,
    cargando,
    errorCarga,
    refrescando,
  } = useInventario();
  const { refrescar } = useAcciones();
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
  const { data: limites } = useLimitesInventario(activo?.id);
  const { data: miPlan } = useMiPlan();
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
        filtro === "reponer" ? esPorReponer(p) : filtro === "agotados" ? p.cantidad === 0 : true,
      )
      .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
  }, [productosActivos, categoriasActivas, busqueda, filtro]);

  const arbol = useMemo(
    () => armarArbol(categoriasActivas, productosActivos),
    [categoriasActivas, productosActivos],
  );
  // Los que hay que completar (categoría y foto) ya salen en el aviso de arriba.
  const sinCategoria = arbol.sinCategoria.filter((p) => !porRevisar.some((r) => r.id === p.id));

  // Los más urgentes: se muestran en un aviso arriba, sin los que ya salen en el de factura.
  const urgentes = useMemo(
    () => porReponer(productosActivos.filter((p) => !porRevisar.some((r) => r.id === p.id))),
    [productosActivos, porRevisar],
  );

  const resumen = useMemo(() => {
    const unidades = productosActivos.reduce((a, p) => a + p.cantidad, 0);
    const reponer = productosActivos.filter(esPorReponer).length;
    const ultima = productosActivos
      .map((p) => p.actualizado_en)
      .sort()
      .at(-1);
    return { unidades, reponer, ultima };
  }, [productosActivos]);

  const editable = permisos.editar_productos;
  // Sin productos todavía: la pantalla se reduce a guiar los primeros pasos.
  const vacio = productosActivos.length === 0;
  const agotados = productosActivos.filter((p) => p.cantidad === 0).length;
  const estado =
    (enVivo ? "En vivo" : "En vivo pausado") +
    (resumen.ultima ? ` · ${haceCuanto(resumen.ultima)}` : "");
  const filtrando = !!busqueda.trim() || filtro !== "todos";

  if (!cargando && !errorCarga && !activo) {
    return (
      <Vista>
        <Encabezado titulo="Inventario" style={entrada(0)} />
        <Vacio
          sf="shippingbox"
          ion="cube-outline"
          titulo="Todavía no tienes inventarios"
          texto={
            "Crea uno para empezar a cargar productos." +
            (usuario
              ? ` Si ya existe uno, pídele al owner que te invite con ${usuario.email}.`
              : "")
          }
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
                [
                  {
                    etiqueta: "Cargar factura",
                    sf: "doc.text.viewfinder",
                    onPress: () => router.push("/factura"),
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
          {!vacio ? (
            <Animated.View style={[s.resumen, entrada(2)]}>
              <View
                style={[
                  s.dato,
                  s.datoDestacado,
                  { backgroundColor: t.tinte, shadowColor: t.tinte },
                ]}
              >
                <Text
                  style={[s.datoValor, { color: "#fff" }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
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
          ) : null}

          {/* Plan y cuánto lleva usado: siempre a la vista, también con el inventario vacío */}
          {limites ? (
            <Animated.View style={entrada(1)}>
              <PlanUso
                plan={limites.plan}
                usos={[
                  // Los inventarios cuentan contra el plan del owner: solo él los ve.
                  ...(permisos.gestionar_accesos && miPlan
                    ? [
                        {
                          etiqueta: "Inventarios",
                          usados: miPlan.inventarios_usados,
                          max: miPlan.max_inventarios,
                        },
                      ]
                    : []),
                  { etiqueta: "Productos", usados: limites.productos, max: limites.max_productos },
                  { etiqueta: "Personas", usados: limites.personas, max: limites.max_personas },
                ]}
                onCambiar={
                  permisos.gestionar_accesos ? () => router.push("/pedir-plan") : undefined
                }
              />
            </Animated.View>
          ) : null}

          {/* Mi rol en este inventario y sus atajos (Kelly) */}
          <Animated.View style={entrada(1)}>
            <TarjetaRol rol={miRol} hayCategorias={categoriasActivas.length > 0} />
          </Animated.View>

          {/* Primeros pasos: el inventario todavía no tiene productos */}
          {vacio && editable ? (
            <Animated.View style={[{ gap: 12 }, entrada(2)]}>
              <PrimerosPasos
                pasos={[
                  {
                    titulo: "Crea una categoría",
                    detalle: "Carpetas para agrupar, como Bebidas o Herramientas.",
                    hecho: categoriasActivas.length > 0,
                    onPress: () =>
                      router.push({ pathname: "/categoria", params: { luego: "producto" } }),
                  },
                  {
                    titulo: "Agrega tu primer producto",
                    detalle: "O carga varios de una vez con una factura o un Excel.",
                    hecho: false,
                    onPress: categoriasActivas.length ? () => router.push("/producto") : undefined,
                  },
                  ...(permisos.gestionar_accesos
                    ? [
                        {
                          titulo: "Invita a tu equipo",
                          detalle: "Dales acceso como editor o lector.",
                          hecho:
                            (activo?.miembros.length ?? 0) > 1 ||
                            (activo?.pendientes.length ?? 0) > 0,
                          opcional: true,
                          onPress: () => router.navigate("/(tabs)/(accesos)"),
                        },
                      ]
                    : []),
                ]}
              />
              <BotonPrincipal
                onPress={() =>
                  categoriasActivas.length
                    ? router.push("/producto")
                    : router.push({ pathname: "/categoria", params: { luego: "producto" } })
                }
              >
                {categoriasActivas.length ? "Agregar producto" : "Crear categoría"}
              </BotonPrincipal>
              <BotonPrincipal variante="gris" onPress={() => router.push("/factura")}>
                Cargar una factura
              </BotonPrincipal>
            </Animated.View>
          ) : null}

          {/* Aviso a quien puede completarlos: productos nuevos de una factura */}
          {porRevisar.length ? (
            <Animated.View style={[{ gap: 6 }, entrada(2)]}>
              <Tarjeta>
                <View style={s.aviso}>
                  <Icono sf="bell.badge.fill" ion="notifications" size={22} color={t.tinte} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[tipo.destacado, { color: t.texto }]}>
                      {porRevisar.length === 1
                        ? "1 producto nuevo para categorizar"
                        : `${porRevisar.length} productos nuevos para categorizar`}
                    </Text>
                    <Text style={[tipo.nota, { color: t.textoSec }]}>
                      Entraron con una factura. Toca cada uno para asignarle su categoría y subir su
                      foto.
                    </Text>
                  </View>
                </View>
                {porRevisar.map((p) => (
                  <View key={p.id}>
                    <Separador sangria={SANGRIA_FILA} />
                    <FilaProducto
                      producto={p}
                      onPress={() => router.push({ pathname: "/producto", params: { id: p.id } })}
                    />
                  </View>
                ))}
              </Tarjeta>
            </Animated.View>
          ) : null}

          {/* Aviso de stock bajo: los más urgentes; "Ver todos" filtra la lista */}
          {!filtrando && urgentes.length ? (
            <Animated.View style={[{ gap: 6 }, entrada(3)]}>
              <Tarjeta>
                <View style={s.aviso}>
                  <Icono
                    sf="exclamationmark.triangle.fill"
                    ion="warning"
                    size={22}
                    color={t.tinte}
                  />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[tipo.destacado, { color: t.texto }]}>
                      {textoAvisoStock(
                        urgentes.length,
                        urgentes.filter((p) => p.cantidad === 0).length,
                      )}
                    </Text>
                    <Text style={[tipo.nota, { color: t.textoSec }]}>
                      Quedaron por debajo del mínimo que definiste.
                    </Text>
                  </View>
                </View>
                {urgentes.slice(0, 3).map((p) => (
                  <View key={p.id}>
                    <Separador sangria={SANGRIA_FILA} />
                    <FilaProducto
                      producto={p}
                      categoria={rutaCategoria(categoriasActivas, p.categoria_id)}
                      onPress={() => router.push({ pathname: "/producto", params: { id: p.id } })}
                    />
                  </View>
                ))}
                {urgentes.length > 3 ? (
                  <>
                    <Separador />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ver los ${urgentes.length} productos por reponer`}
                      onPress={() => (tocar(), setFiltro("reponer"))}
                      style={({ pressed }) => [
                        s.verTodos,
                        pressed && { backgroundColor: t.relleno },
                      ]}
                    >
                      <Text style={[tipo.cuerpo, { color: t.tinte }]}>
                        Ver los {urgentes.length}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </Tarjeta>
            </Animated.View>
          ) : null}

          {/* Búsqueda y filtro: solo hay algo que buscar si hay productos */}
          {!vacio ? (
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
                  {
                    valor: "reponer",
                    etiqueta: resumen.reponer ? `Por reponer · ${resumen.reponer}` : "Por reponer",
                  },
                  { valor: "agotados", etiqueta: agotados ? `Agotados · ${agotados}` : "Agotados" },
                ]}
              />
            </Animated.View>
          ) : null}

          {/* Lista: buscando o filtrando, plana; si no, en carpetas por categoría. */}
          <Animated.View style={[{ gap: 12 }, entrada(4)]}>
            {filtrando ? (
              lista.length ? (
                <View style={{ gap: 6 }}>
                  <Tarjeta>
                    {lista.map((p, i) => (
                      <View key={p.id}>
                        {i > 0 ? <Separador sangria={SANGRIA_FILA} /> : null}
                        <FilaProducto
                          producto={p}
                          categoria={rutaCategoria(categoriasActivas, p.categoria_id)}
                          onPress={() =>
                            router.push({ pathname: "/producto", params: { id: p.id } })
                          }
                        />
                      </View>
                    ))}
                  </Tarjeta>
                  <Text style={[s.pie, { color: t.textoSec }]}>
                    {lista.length} de {productosActivos.length} productos
                  </Text>
                </View>
              ) : (
                <Vacio
                  sf="magnifyingglass"
                  ion="search"
                  titulo="Sin resultados"
                  texto="Prueba con otra búsqueda o cambia el filtro."
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
                {sinCategoria.length ? (
                  <View style={{ gap: 6 }}>
                    <Text style={[s.pie, { color: t.textoSec }]}>
                      Sin categoría{editable ? " · toca uno para asignarle una" : ""}
                    </Text>
                    <Tarjeta>
                      {sinCategoria.map((p, i) => (
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
            ) : editable ? null : (
              <Vacio
                sf="folder.badge.plus"
                ion="folder-open-outline"
                titulo="Todavía no hay productos"
                texto="Cuando el owner o un editor los cargue, los vas a ver aquí."
              />
            )}
          </Animated.View>

          {/* Historial: se usa poco, va al final y sin tarjeta */}
          {permisos.gestionar_accesos && !vacio && !filtrando ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Muestra quién agregó, ajustó o eliminó productos"
              onPress={() => (tocar(), router.push("/historial"))}
              style={({ pressed }) => [s.historial, pressed && { opacity: 0.6 }]}
            >
              <Icono sf="clock.arrow.circlepath" ion="time-outline" size={18} color={t.tinte} />
              <Text style={[tipo.cuerpo, { color: t.tinte }]}>Ver historial de movimientos</Text>
            </Pressable>
          ) : null}
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
  historial: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
  },
  verTodos: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  aviso: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
});
