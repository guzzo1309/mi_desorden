import type { Producto } from "@mi-desorden/core";
import { router, useIsFocused } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mensajeError } from "@/api";
import { Stepper } from "@/components/Stepper";
import { BotonPrincipal, BotonVidrio, Icono, tocar, Vidrio } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { rutaCategoria } from "@/lib/categorias";
import { fotoPendiente, type Foto } from "@/lib/fotoPendiente";
import { ofrecerFotoDeCamara, rutasDe } from "@/lib/fotos";
import { huellasDe } from "@/lib/huellas";
import { reducirFoto } from "@/lib/imagen";
import { decidir, puntuar } from "@/lib/reconocer";
import { aplanarHuellas, mejorDistancia } from "@/lib/referencias";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { SinCamara } from "@/web/SinCamara";
import { tipo, useTema } from "@/lib/theme";
import { Reconocer } from "@/modules/reconocer";

type Escaneo =
  | { fase: "listo" }
  | { fase: "analizando" }
  /**
   * Lo reconoció: se muestra con su cantidad para corregirla. `corregido`: el modelo
   * dudó y alguien eligió el producto: esa foto sirve para que la próxima vez acierte.
   */
  | { fase: "encontrado"; producto: Producto; otros: Producto[]; foto: Foto; corregido: boolean }
  /** Duda entre varios (o el usuario dijo "no es este"). */
  | { fase: "dudoso"; opciones: Producto[]; sugerencia: string; foto: Foto; orden?: string[] }
  /** No se parece a nada del inventario: se ofrece agregarlo o decir que es uno que ya existe. */
  | { fase: "nuevo"; sugerencia: string; foto: Foto; orden?: string[] }
  /** Todos los productos, del más al menos parecido: elegir cuál es (así la foto lo entrena). */
  | { fase: "existente"; sugerencia: string; foto: Foto; orden?: string[] }
  | { fase: "error"; mensaje: string };

const vibrar = (tipoAviso: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") Haptics.notificationAsync(tipoAviso).catch(() => {});
};

/**
 * Cámara que reconoce productos en el teléfono (Apple Vision, sin red): compara
 * la foto con las fotos de los productos y lee el texto de la etiqueta. Al
 * reconocer uno, muestra su cantidad para corregirla; si no lo conoce, ofrece
 * agregarlo con esa misma foto, que queda de referencia.
 */
function CamaraNativa() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const enFoco = useIsFocused();
  const camara = useRef<CameraView>(null);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { enVivo } = useSesion();
  const { activo, productosActivos, categoriasActivas, permisos } = useInventario();
  const [linterna, setLinterna] = useState(false);
  const [escaneo, setEscaneo] = useState<Escaneo>({ fase: "listo" });

  // Huellas de las fotos de los productos: se preparan al abrir la cámara.
  const [huellas, setHuellas] = useState<Record<string, string[]>>({});
  const [preparando, setPreparando] = useState<{ hechas: number; total: number } | null>(null);
  const clave = productosActivos.map((p) => `${p.id}:${rutasDe(p).join("|")}`).join(",");
  useEffect(() => {
    if (!enFoco || !Reconocer) return;
    let vivo = true;
    huellasDe(productosActivos, (hechas, total) => vivo && setPreparando({ hechas, total }))
      .then((h) => vivo && setHuellas(h))
      .finally(() => vivo && setPreparando(null));
    return () => {
      vivo = false;
    };
    // Depende de `clave` (ids y fotos) y no de la lista entera: si no, recalcula en cada render.
  }, [enFoco, clave]);

  const candidatos = useMemo(
    () =>
      productosActivos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        categoria: rutaCategoria(categoriasActivas, p.categoria_id),
      })),
    [productosActivos, categoriasActivas],
  );
  const porId = (id: string) => productosActivos.find((p) => p.id === id);
  const sinFoto = productosActivos.filter((p) => !p.foto_path).length;

  if (!permiso) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permiso.granted) {
    return (
      <View style={[s.permiso, { backgroundColor: t.fondo, paddingTop: insets.top }]}>
        <View style={[s.permisoIcono, { backgroundColor: t.relleno }]}>
          <Icono sf="camera.fill" ion="camera" size={36} color={t.tinte} />
        </View>
        <Text style={[tipo.titulo2, { color: t.texto, textAlign: "center" }]}>
          Acceso a la cámara
        </Text>
        <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center", maxWidth: 320 }]}>
          La usamos para reconocer tus productos por su foto y su etiqueta. Todo pasa en el
          teléfono: la foto no se sube a ningún lado.
        </Text>
        <View style={{ width: "100%", maxWidth: 320, marginTop: 8 }}>
          {permiso.canAskAgain ? (
            <BotonPrincipal onPress={pedirPermiso}>Permitir acceso</BotonPrincipal>
          ) : (
            <BotonPrincipal onPress={() => Linking.openSettings()}>Abrir Ajustes</BotonPrincipal>
          )}
        </View>
      </View>
    );
  }

  async function reconocer() {
    if (escaneo.fase === "analizando" || !camara.current) return;
    if (!Reconocer) {
      setEscaneo({
        fase: "error",
        mensaje:
          Platform.OS === "ios"
            ? "Esta versión de la app todavía no reconoce productos: hay que reinstalarla."
            : "Por ahora el reconocimiento funciona solo en iPhone.",
      });
      return;
    }
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEscaneo({ fase: "analizando" });
    try {
      const tomada = await camara.current.takePictureAsync({ quality: 0.7 });
      if (!tomada?.uri) throw new Error("No se pudo sacar la foto.");
      // Misma medida que las fotos guardadas: se compara igual y se analiza más rápido.
      const foto = await reducirFoto(tomada.uri);
      // Cada producto tiene hasta 3 fotos de referencia: vale la que más se parezca.
      const analisis = await Reconocer.analizar(foto.uri, aplanarHuellas(huellas));
      const distancias = mejorDistancia(analisis.distancias);
      const { textos } = analisis;
      const v = decidir(candidatos, distancias, textos);
      // Todos los productos del más al menos parecido: si no acierta, se elige de esta lista.
      const orden = puntuar(candidatos, distancias, textos).map((x) => x.id);
      const elegido = v.producto ? porId(v.producto.id) : undefined;
      const otros = v.alternativas.map((a) => porId(a.id)).filter((p): p is Producto => !!p);

      if (elegido) {
        vibrar(Haptics.NotificationFeedbackType.Success);
        setEscaneo({ fase: "encontrado", producto: elegido, otros, foto, corregido: false });
      } else if (otros.length) {
        vibrar(Haptics.NotificationFeedbackType.Warning);
        setEscaneo({ fase: "dudoso", opciones: otros, sugerencia: v.sugerencia, foto, orden });
      } else {
        vibrar(Haptics.NotificationFeedbackType.Warning);
        setEscaneo({ fase: "nuevo", sugerencia: v.sugerencia, foto, orden });
      }
    } catch (e) {
      vibrar(Haptics.NotificationFeedbackType.Error);
      setEscaneo({ fase: "error", mensaje: mensajeError(e) });
    }
  }

  function agregar(sugerencia: string, foto: Foto) {
    // La foto queda como la del producto solo si quien lo agrega puede manejar fotos.
    if (permisos.gestionar_fotos) fotoPendiente.poner(foto);
    else fotoPendiente.descartar();
    setEscaneo({ fase: "listo" });
    router.push({ pathname: "/producto", params: { desdeCamara: "1", nombre: sugerencia } });
  }

  const cerrar = () => setEscaneo({ fase: "listo" });
  const abajo = insets.bottom + (Platform.OS === "ios" ? 12 : 72);
  // Lector: la cámara solo consulta (no ajusta ni agrega).
  const lector = !permisos.ajustar_stock && !permisos.editar_productos;
  const pista =
    escaneo.fase === "analizando"
      ? "Reconociendo…"
      : preparando
        ? `Preparando las fotos de tus productos (${preparando.hechas}/${preparando.total})…`
        : lector
          ? "Modo consulta: apunta a un producto para ver cuánto hay"
          : !productosActivos.length
            ? permisos.gestionar_fotos
              ? "Apunta a un producto: si no está, lo agregas con esta foto"
              : "Apunta a un producto: si no está, lo puedes agregar"
            : sinFoto
              ? `Apunta a un producto · ${sinFoto} sin foto se reconocen solo por la etiqueta`
              : "Apunta a un producto y toca el disparador";

  return (
    <View style={s.fondo}>
      {enFoco ? (
        <CameraView
          ref={camara}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={linterna}
        />
      ) : null}

      {/* Arriba: inventario activo + linterna */}
      <View style={[s.arriba, { top: insets.top + 8 }]}>
        <Vidrio claro style={s.capsula}>
          <View style={[s.punto, { backgroundColor: enVivo ? t.verde : "#8E8E93" }]} />
          <Text style={[tipo.subtitulo, s.textoClaro]} numberOfLines={1}>
            {(activo?.nombre ?? "Sin inventario") + (lector ? " · Consulta" : "")}
          </Text>
        </Vidrio>
        <BotonVidrio
          claro
          etiqueta={linterna ? "Apagar linterna" : "Encender linterna"}
          sf={linterna ? "flashlight.on.fill" : "flashlight.off.fill"}
          ion={linterna ? "flashlight" : "flashlight-outline"}
          color={linterna ? t.amarillo : "#fff"}
          onPress={() => setLinterna((v) => !v)}
        />
      </View>

      {/* Centro: visor */}
      <View style={s.centro} pointerEvents="none">
        <Visor
          color={t.tinte}
          buscando={escaneo.fase === "analizando"}
          marcado={escaneo.fase === "analizando" || escaneo.fase === "encontrado"}
        />
      </View>

      {/* Abajo: resultado o pista, y el disparador */}
      <View style={[s.abajo, { bottom: abajo }]}>
        {escaneo.fase === "listo" || escaneo.fase === "analizando" ? (
          <Vidrio claro style={s.pista}>
            <Text style={[tipo.nota, s.textoClaro, { textAlign: "center" }]}>{pista}</Text>
          </Vidrio>
        ) : (
          <Resultado
            escaneo={escaneo}
            puedeAgregar={permisos.editar_productos}
            puedeAjustar={permisos.ajustar_stock}
            puedeFotos={permisos.gestionar_fotos}
            onElegir={(producto, foto) =>
              setEscaneo({ fase: "encontrado", producto, otros: [], foto, corregido: true })
            }
            onNoEs={(e) =>
              setEscaneo({
                fase: "dudoso",
                opciones: e.otros,
                sugerencia: "",
                foto: e.foto,
              })
            }
            onBuscar={(e) =>
              setEscaneo({
                fase: "existente",
                sugerencia: e.fase === "encontrado" ? "" : e.sugerencia,
                foto: e.foto,
                orden: e.fase === "encontrado" ? undefined : e.orden,
              })
            }
            productos={productosActivos}
            onAgregar={agregar}
            onCerrar={cerrar}
          />
        )}

        {escaneo.fase === "listo" || escaneo.fase === "analizando" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reconocer producto"
            onPress={reconocer}
            style={({ pressed }) => [s.disparador, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            <View style={s.disparadorInterior}>
              {escaneo.fase === "analizando" ? <ActivityIndicator color="#000" /> : null}
            </View>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** Esquinas del visor: se tiñen mientras analiza y cuando reconoció algo; laten al analizar. */
function Visor({
  color,
  buscando,
  marcado,
}: {
  color: string;
  buscando: boolean;
  marcado: boolean;
}) {
  const pulso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!buscando) {
      pulso.stopAnimation();
      pulso.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulso, {
          toValue: 1,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulso, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [buscando, pulso]);

  const escala = pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
  const esquina = (pos: object) => (
    <View style={[s.esquina, { borderColor: marcado ? color : "#fff" }, pos]} />
  );

  return (
    <Animated.View style={[s.visor, { transform: [{ scale: escala }] }]}>
      {esquina({ top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 28 })}
      {esquina({
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 28,
      })}
      {esquina({
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 28,
      })}
      {esquina({
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 28,
      })}
    </Animated.View>
  );
}

type EscaneoConResultado = Exclude<Escaneo, { fase: "listo" } | { fase: "analizando" }>;

function Resultado({
  escaneo,
  puedeAgregar,
  puedeAjustar,
  puedeFotos,
  onElegir,
  onNoEs,
  onBuscar,
  productos,
  onAgregar,
  onCerrar,
}: {
  escaneo: EscaneoConResultado;
  puedeAgregar: boolean;
  puedeAjustar: boolean;
  puedeFotos: boolean;
  onElegir: (p: Producto, foto: Foto) => void;
  onNoEs: (e: Extract<Escaneo, { fase: "encontrado" }>) => void;
  /** Abre la lista de todos los productos para elegir cuál es. */
  onBuscar: (e: Extract<Escaneo, { fase: "dudoso" | "nuevo" | "encontrado" }>) => void;
  productos: Producto[];
  onAgregar: (sugerencia: string, foto: Foto) => void;
  onCerrar: () => void;
}) {
  const t = useTema();
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrada.setValue(0);
    Animated.spring(entrada, {
      toValue: 1,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
    }).start();
  }, [entrada, escaneo.fase]);

  const estilo = {
    opacity: entrada,
    transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };
  const cerrar = (
    <BotonVidrio etiqueta="Cerrar" sf="xmark" ion="close" tam={32} onPress={onCerrar} />
  );

  return (
    <Animated.View style={[{ width: "100%", maxWidth: 420 }, estilo]}>
      <Vidrio style={s.tarjeta}>
        {escaneo.fase === "encontrado" ? (
          <Encontrado
            escaneo={escaneo}
            editable={puedeAjustar}
            puedeFotos={puedeFotos}
            cerrar={cerrar}
            onNoEs={() => onNoEs(escaneo)}
            onCerrar={onCerrar}
          />
        ) : escaneo.fase === "dudoso" ? (
          <>
            <View style={s.tarjetaFila}>
              <View style={{ flex: 1 }}>
                <Text style={[tipo.destacado, { color: t.texto }]}>¿Cuál es?</Text>
                <Text style={[tipo.nota, { color: t.textoSec }]}>
                  {escaneo.opciones.length
                    ? "Se parece a estos. Elige el correcto."
                    : "No encontré otro parecido."}
                </Text>
              </View>
              {cerrar}
            </View>
            {escaneo.opciones.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                onPress={() => (tocar(), onElegir(p, escaneo.foto))}
                style={({ pressed }) => [
                  s.opcion,
                  { backgroundColor: pressed ? t.relleno : "transparent" },
                ]}
              >
                <Miniatura producto={p} />
                <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]} numberOfLines={1}>
                  {p.nombre}
                </Text>
                <Text style={[tipo.nota, { color: t.textoSec }]}>{p.cantidad}</Text>
              </Pressable>
            ))}
            {productos.length > escaneo.opciones.length ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => (tocar(), onBuscar(escaneo))}
              >
                <Text
                  style={[tipo.nota, { color: t.tinte, textAlign: "center", fontWeight: "600" }]}
                >
                  Ninguno: ver todos los productos
                </Text>
              </Pressable>
            ) : null}
            {puedeAgregar ? (
              <BotonPrincipal
                variante="gris"
                onPress={() => onAgregar(escaneo.sugerencia, escaneo.foto)}
              >
                Es otro: agregar producto
              </BotonPrincipal>
            ) : null}
          </>
        ) : escaneo.fase === "existente" ? (
          <>
            <View style={s.tarjetaFila}>
              <View style={{ flex: 1 }}>
                <Text style={[tipo.destacado, { color: t.texto }]}>¿Cuál es?</Text>
                <Text style={[tipo.nota, { color: t.textoSec }]}>
                  Elige el producto: la foto se guarda para reconocerlo mejor la próxima vez.
                </Text>
              </View>
              {cerrar}
            </View>
            <ScrollView style={s.listaTodos} showsVerticalScrollIndicator={false}>
              {[...productos]
                .sort((a, b) => {
                  const orden = escaneo.orden;
                  if (!orden) return a.nombre.localeCompare(b.nombre, "es");
                  const ia = orden.indexOf(a.id);
                  const ib = orden.indexOf(b.id);
                  return (ia < 0 ? 9999 : ia) - (ib < 0 ? 9999 : ib);
                })
                .map((p) => (
                  <Pressable
                    key={p.id}
                    accessibilityRole="button"
                    onPress={() => (tocar(), onElegir(p, escaneo.foto))}
                    style={({ pressed }) => [
                      s.opcion,
                      { backgroundColor: pressed ? t.relleno : "transparent" },
                    ]}
                  >
                    <Miniatura producto={p} />
                    <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]} numberOfLines={1}>
                      {p.nombre}
                    </Text>
                    <Text style={[tipo.nota, { color: t.textoSec }]}>{p.cantidad}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            {puedeAgregar ? (
              <BotonPrincipal
                variante="gris"
                onPress={() => onAgregar(escaneo.sugerencia, escaneo.foto)}
              >
                Es nuevo: agregar producto
              </BotonPrincipal>
            ) : null}
          </>
        ) : escaneo.fase === "nuevo" ? (
          <>
            <View style={s.tarjetaFila}>
              <View style={[s.miniatura, { backgroundColor: t.relleno }]}>
                <Icono sf="questionmark" ion="help" size={20} color={t.textoSec} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[tipo.destacado, { color: t.texto }]}>No lo reconozco</Text>
                <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={2}>
                  {escaneo.sugerencia
                    ? `En la etiqueta dice “${escaneo.sugerencia}”.`
                    : "No se parece a ningún producto de este inventario."}
                </Text>
              </View>
              {cerrar}
            </View>
            {puedeAgregar ? (
              <BotonPrincipal onPress={() => onAgregar(escaneo.sugerencia, escaneo.foto)}>
                {escaneo.sugerencia ? `Agregar “${escaneo.sugerencia}”` : "Agregar producto"}
              </BotonPrincipal>
            ) : (
              // Sin permiso para agregar: se le pide al owner o a un editor.
              <BotonPrincipal
                variante="gris"
                onPress={() =>
                  router.push({
                    pathname: "/solicitud",
                    params: { tipo: "agregar", nombre: escaneo.sugerencia },
                  })
                }
              >
                Pedir que lo agreguen
              </BotonPrincipal>
            )}
            {productos.length ? (
              <BotonPrincipal variante="gris" onPress={() => onBuscar(escaneo)}>
                Es uno que ya existe
              </BotonPrincipal>
            ) : null}
          </>
        ) : (
          <View style={s.tarjetaFila}>
            <View style={[s.miniatura, { backgroundColor: t.relleno }]}>
              <Icono
                sf="exclamationmark.triangle"
                ion="warning-outline"
                size={20}
                color={t.textoSec}
              />
            </View>
            <Text style={[tipo.nota, { color: t.texto, flex: 1 }]}>{escaneo.mensaje}</Text>
            {cerrar}
          </View>
        )}
      </Vidrio>
    </Animated.View>
  );
}

/** Reconocido: su cantidad con ± para corregirla ahí mismo. */
function Encontrado({
  escaneo,
  editable,
  puedeFotos,
  cerrar,
  onNoEs,
  onCerrar,
}: {
  escaneo: Extract<Escaneo, { fase: "encontrado" }>;
  editable: boolean;
  puedeFotos: boolean;
  cerrar: React.ReactNode;
  onNoEs: () => void;
  onCerrar: () => void;
}) {
  const t = useTema();
  const { categoriasActivas } = useInventario();
  const { ajustarDesdeCamara, agregarFotoExtra } = useAcciones();
  const { producto } = escaneo;
  const [cantidad, setCantidad] = useState(producto.cantidad);
  // Guardar esta foto como referencia: viene prendido; el producto se reconoce mejor cada vez.
  const ofrecerFoto = ofrecerFotoDeCamara(producto, { corregido: escaneo.corregido, puedeFotos });
  const [guardarFoto, setGuardarFoto] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cambio = cantidad !== producto.cantidad;
  const detalle = [rutaCategoria(categoriasActivas, producto.categoria_id), producto.ubicacion]
    .filter(Boolean)
    .join(" · ");

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await ajustarDesdeCamara(producto.id, cantidad);
      // La foto es un extra: si no sube, la cantidad ya quedó guardada.
      if (ofrecerFoto && guardarFoto) {
        await agregarFotoExtra(producto, escaneo.foto.base64).catch(() => {});
      }
      vibrar(Haptics.NotificationFeedbackType.Success);
      onCerrar();
    } catch (e) {
      setError(mensajeError(e));
      setGuardando(false);
    }
  }

  return (
    <>
      <View style={s.tarjetaFila}>
        <Miniatura producto={producto} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[tipo.destacado, { color: t.texto }]} numberOfLines={1}>
            {producto.nombre}
          </Text>
          {detalle ? (
            <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
              {detalle}
            </Text>
          ) : null}
        </View>
        {cerrar}
      </View>

      <View style={[s.cantidad, { backgroundColor: t.relleno }]}>
        <View style={{ flex: 1 }}>
          <Text style={[tipo.nota, { color: t.textoSec }]}>
            {cambio ? `Antes: ${producto.cantidad}` : "En inventario"}
          </Text>
          <Text style={[tipo.titulo2, { color: t.texto, fontVariant: ["tabular-nums"] }]}>
            {cantidad}
          </Text>
        </View>
        {editable ? <Stepper valor={cantidad} onCambio={setCantidad} /> : null}
      </View>

      {ofrecerFoto ? (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: guardarFoto }}
          onPress={() => (tocar(), setGuardarFoto((v) => !v))}
          style={s.guardarFoto}
        >
          <Icono
            sf={guardarFoto ? "checkmark.circle.fill" : "circle"}
            ion={guardarFoto ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={guardarFoto ? t.tinte : t.textoTer}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[tipo.nota, { color: t.texto, fontWeight: "600" }]}>
              Guardar esta foto para reconocerlo mejor
            </Text>
            <Text style={[tipo.leyenda, { color: t.textoSec }]}>
              {escaneo.corregido
                ? "Así la próxima vez no se confunde."
                : "Tiene pocas fotos: otra ayuda a reconocerlo."}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {error ? <Text style={[tipo.nota, { color: t.rojo }]}>{error}</Text> : null}

      {editable ? (
        <BotonPrincipal onPress={guardar} cargando={guardando}>
          {cambio ? "Guardar cantidad" : "Está bien así"}
        </BotonPrincipal>
      ) : null}
      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => (tocar(), onNoEs())}>
        <Text style={[tipo.nota, { color: t.tinte, textAlign: "center", fontWeight: "600" }]}>
          No es este producto
        </Text>
      </Pressable>
    </>
  );
}

function Miniatura({ producto }: { producto: Producto }) {
  const t = useTema();
  return producto.foto_path ? (
    <FotoProducto ruta={producto.foto_path} tam={44} />
  ) : (
    <View style={[s.miniatura, { backgroundColor: t.relleno }]}>
      <Icono sf="shippingbox" ion="cube-outline" size={20} color={t.textoSec} />
    </View>
  );
}

const s = StyleSheet.create({
  listaTodos: { maxHeight: 280 },
  guardarFoto: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  fondo: { flex: 1, backgroundColor: "#000" },
  permiso: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  permisoIcono: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  arriba: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  capsula: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    flexShrink: 1,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  textoClaro: {
    color: "#fff",
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowRadius: 4,
  },
  centro: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 140,
  },
  visor: { width: "68%", maxWidth: 320, aspectRatio: 1 },
  esquina: { position: "absolute", width: 52, height: 52 },
  abajo: { position: "absolute", left: 16, right: 16, alignItems: "center", gap: 16 },
  pista: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, maxWidth: 360 },
  disparador: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  disparadorInterior: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  tarjeta: { borderRadius: 30, padding: 16, gap: 12 },
  tarjetaFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  miniatura: {
    width: 44,
    height: 44,
    borderRadius: 44 * 0.22,
    alignItems: "center",
    justifyContent: "center",
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  cantidad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
});

/** En web no hay cámara del teléfono: se avisa en vez de abrir un visor vacío. */
export default function Camara() {
  return Platform.OS === "web" ? (
    <SinCamara texto="Usa la app en tu celular (Android o iPhone) para reconocer productos con la cámara." />
  ) : (
    <CamaraNativa />
  );
}
