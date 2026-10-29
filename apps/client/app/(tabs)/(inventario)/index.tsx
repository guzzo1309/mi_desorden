import { useEsAncho } from "@/lib/pantalla";
import { useQuery } from "@tanstack/react-query";
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
import { mensajeError, movimientos, productos as productosApi } from "@/api";
import { Carpeta } from "@/components/Carpeta";
import { FilaProducto, SANGRIA_FILA } from "@/components/FilaProducto";
import { PlanUso } from "@/components/PlanUso";
import { MenuMas } from "@/components/menus";
import { PrimerosPasos } from "@/components/PrimerosPasos";
import { Solicitudes } from "@/components/Solicitudes";
import { TarjetaRol } from "@/components/TarjetaRol";
import { confirmar } from "@/lib/confirmar";
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
import { haceCuanto, inicioDeHoy } from "@/lib/fecha";
import {
  coincideChip,
  contarResumen,
  esAgotado,
  nivelSalud,
  textoAgotados,
  type ChipFiltro,
} from "@/lib/resumen";
import { esPorReponer, porReponer, textoAvisoStock } from "@/lib/stock";
import { useLimitesInventario, useMiPlan } from "@/lib/miPlan";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

type Filtro = "todos" | "reponer" | "agotados";

export default function Inventario() {
  const esAncho = useEsAncho();
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
  const { refrescar, optimizarFotos } = useAcciones();
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
  // Filtro que viene de un chip del resumen (pocas fotos, sin categoría): excluye al segmentado.
  const [chip, setChip] = useState<ChipFiltro | null>(null);
  const elegirFiltro = (f: Filtro) => (setChip(null), setFiltro(f));
  const elegirChip = (c: ChipFiltro | null) => (setFiltro("todos"), setChip(c));
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
        filtro === "reponer" ? esPorReponer(p) : filtro === "agotados" ? esAgotado(p) : true,
      )
      .filter((p) => !chip || coincideChip(p, chip))
      .sort((a, b) => a.ubicacion.localeCompare(b.ubicacion));
  }, [productosActivos, categoriasActivas, busqueda, filtro, chip]);

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
    const ultima = productosActivos
      .map((p) => p.actualizado_en)
      .sort()
      .at(-1);
    return { ...contarResumen(productosActivos), ultima };
  }, [productosActivos]);

  // Para el owner: cuánta actividad tuvo el equipo hoy (cuenta solo si ve el historial).
  const { data: pesadas } = useQuery({
    queryKey: ["fotosPesadas", activo?.id],
    enabled: !!activo && permisos.gestionar_fotos,
    queryFn: () => productosApi.fotosPesadas(activo!.id),
    staleTime: 10 * 60_000,
  });
  const [optimizando, setOptimizando] = useState<{ hechas: number; total: number } | null>(null);

  function optimizar() {
    if (!activo || optimizando) return;
    const inv = activo.id;
    confirmar(
      `¿Optimizar ${pesadas?.length ?? 0} fotos?`,
      "Se achican a ~100 KB (se ven igual) para que carguen mucho más rápido. Tarda unos segundos por foto: no cierres la app.",
      "Optimizar",
      () => {
        setOptimizando({ hechas: 0, total: pesadas?.length ?? 0 });
        void optimizarFotos(inv, (hechas, total) => setOptimizando({ hechas, total }))
          .catch(() => {})
          .finally(() => setOptimizando(null));
      },
    );
  }

  const { data: movHoy } = useQuery({
    queryKey: ["historial", "hoy", activo?.id],
    enabled: !!activo && permisos.gestionar_accesos,
    queryFn: () => movimientos.contarDesde(activo!.id, inicioDeHoy()),
  });

  const editable = permisos.editar_productos;
  // Sin productos todavía: la pantalla se reduce a guiar los primeros pasos.
  const vacio = productosActivos.length === 0;
  const estado =
    (enVivo ? "En vivo" : "En vivo pausado") +
    (resumen.total ? ` · ${resumen.total} ${resumen.total === 1 ? "producto" : "productos"}` : "") +
    (resumen.ultima ? ` · ${haceCuanto(resumen.ultima)}` : "");
  const filtrando = !!busqueda.trim() || filtro !== "todos" || !!chip;

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
          {/* Resumen: lo que pide acción (reponer) y dos números de salud */}
          {!vacio ? (
            <Animated.View style={[s.resumen, entrada(2)]}>
              <Pressable
                accessibilityRole="button"
                accessibilityHint="Muestra solo los productos por reponer"
                disabled={!resumen.reponer}
                onPress={() => (tocar(), elegirFiltro("reponer"))}
                style={({ pressed }) => [
                  s.dato,
                  s.datoDestacado,
                  {
                    backgroundColor: !resumen.reponer
                      ? t.verde
                      : resumen.agotados
                        ? t.rojo
                        : t.tinte,
                    shadowColor: !resumen.reponer ? t.verde : resumen.agotados ? t.rojo : t.tinte,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[s.datoValor, { color: "#fff" }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {resumen.reponer}
                </Text>
                <Text style={[s.datoEtiqueta, { color: "#fff", fontWeight: "600" }]}>
                  Por reponer
                </Text>
                <Text style={[s.datoSub, { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
                  {resumen.agotados
                    ? textoAgotados(resumen.agotados)
                    : resumen.reponer
                      ? "Bajo el mínimo"
                      : "Todo en stock"}
                </Text>
              </Pressable>

              <DatoPorcentaje
                valor={resumen.pctEnRegla}
                etiqueta="En regla"
                sub="sobre su mínimo"
                nivel={nivelSalud(resumen.pctEnRegla, { bien: 90, medio: 70 })}
              />

              {permisos.gestionar_fotos ? (
                <DatoPorcentaje
                  valor={resumen.pctCamaraLista}
                  etiqueta="Cámara lista"
                  sub="con 2+ fotos"
                  nivel={nivelSalud(resumen.pctCamaraLista, { bien: 80, medio: 50 })}
                  onPress={
                    resumen.pocasFotos
                      ? () => elegirChip(chip === "pocasFotos" ? null : "pocasFotos")
                      : undefined
                  }
                  ayuda="Muestra los productos con pocas fotos"
                />
              ) : (
                <DatoPorcentaje
                  valor={activo?.miembros.filter((m) => m.en_linea).length ?? 0}
                  etiqueta="En línea"
                  sub={`de ${activo?.miembros.length ?? 0} ${activo?.miembros.length === 1 ? "persona" : "personas"}`}
                  nivel="bien"
                  sinPorcentaje
                />
              )}
            </Animated.View>
          ) : null}

          {/* Chips: lo que conviene arreglar. Los que valen 0 no se muestran. */}
          {!vacio ? (
            <Animated.View style={[s.chips, entrada(2)]}>
              {permisos.gestionar_fotos && (pesadas?.length || optimizando) ? (
                <Chip
                  sf="bolt.fill"
                  ion="flash"
                  texto={
                    optimizando
                      ? `Optimizando ${optimizando.hechas}/${optimizando.total}…`
                      : `Optimizar fotos · ${pesadas?.length}`
                  }
                  ayuda="Achica las fotos pesadas para que carguen más rápido"
                  onPress={optimizar}
                />
              ) : null}
              {editable && resumen.sinCategoria ? (
                <Chip
                  sf="folder.badge.questionmark"
                  ion="folder-open"
                  texto={`Sin categoría · ${resumen.sinCategoria}`}
                  ayuda="Productos sin carpeta"
                  activo={chip === "sinCategoria"}
                  onPress={() => elegirChip(chip === "sinCategoria" ? null : "sinCategoria")}
                />
              ) : null}
              {permisos.gestionar_accesos && movHoy ? (
                <Chip
                  sf="clock.arrow.circlepath"
                  ion="time-outline"
                  texto={`Movimientos hoy · ${movHoy}`}
                  ayuda="Abre el historial de movimientos"
                  onPress={() => router.push("/historial")}
                />
              ) : null}
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
                      Entraron con una factura. Complétalos para que la cámara los reconozca:
                      categoría, lugar y fotos.
                    </Text>
                  </View>
                </View>
                <Separador />
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Te guía producto por producto: categoría, lugar y fotos"
                  onPress={() => (tocar(), router.push("/revision"))}
                  style={({ pressed }) => [s.verTodos, pressed && { backgroundColor: t.relleno }]}
                >
                  <Text style={[tipo.destacado, { color: t.tinte }]}>Completar uno por uno</Text>
                </Pressable>
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
                      onPress={() => (tocar(), elegirFiltro("reponer"))}
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

          {/* Pedidos de los lectores: para resolver, o los míos pendientes */}
          <Animated.View style={entrada(2)}>
            <Solicitudes />
          </Animated.View>

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
                onCambio={elegirFiltro}
                opciones={[
                  { valor: "todos", etiqueta: "Todos" },
                  {
                    valor: "reponer",
                    etiqueta: resumen.reponer ? `Por reponer · ${resumen.reponer}` : "Por reponer",
                  },
                  {
                    valor: "agotados",
                    etiqueta: resumen.agotados ? `Agotados · ${resumen.agotados}` : "Agotados",
                  },
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
                    <View
                      style={
                        esAncho ? { flexDirection: "row", flexWrap: "wrap", gap: 16 } : undefined
                      }
                    >
                      {lista.map((p, i) => (
                        <View key={p.id} style={esAncho ? { width: "31%" } : undefined}>
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

/** Una tarjeta del resumen con un número de salud: verde, naranja o rojo según qué tan bien está. */
function DatoPorcentaje({
  valor,
  etiqueta,
  sub,
  nivel,
  onPress,
  ayuda,
  sinPorcentaje,
}: {
  valor: number;
  etiqueta: string;
  sub: string;
  nivel: "bien" | "medio" | "mal";
  onPress?: () => void;
  ayuda?: string;
  /** Muestra el número tal cual, sin "%". */
  sinPorcentaje?: boolean;
}) {
  const t = useTema();
  const color = nivel === "bien" ? t.verde : nivel === "medio" ? t.tinte : t.rojo;
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${etiqueta}: ${valor}${sinPorcentaje ? "" : " por ciento"}, ${sub}`}
      accessibilityHint={onPress ? ayuda : undefined}
      disabled={!onPress}
      onPress={() => (tocar(), onPress?.())}
      style={({ pressed }) => [s.dato, { backgroundColor: t.celda, opacity: pressed ? 0.7 : 1 }]}
    >
      <Text style={[s.datoValor, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
        {sinPorcentaje ? "" : "%"}
      </Text>
      <Text style={[s.datoEtiqueta, { color: t.texto, fontWeight: "600" }]} numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text style={[s.datoSub, { color: t.textoSec }]} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

/** Píldora chica del resumen. Con `activo` queda marcada (es un filtro prendido). */
function Chip({
  sf,
  ion,
  texto,
  ayuda,
  activo,
  onPress,
}: {
  sf: Parameters<typeof Icono>[0]["sf"];
  ion: Parameters<typeof Icono>[0]["ion"];
  texto: string;
  ayuda: string;
  activo?: boolean;
  onPress: () => void;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityHint={ayuda}
      accessibilityState={{ selected: !!activo }}
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => [
        s.chip,
        { backgroundColor: activo ? t.tinte : t.celda, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icono sf={sf} ion={ion} size={14} color={activo ? "#fff" : t.tinte} />
      <Text style={[tipo.nota, { color: activo ? "#fff" : t.texto, fontWeight: "600" }]}>
        {texto}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
  },
  datoSub: { fontSize: 12, marginTop: 2 },
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
