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
import { huellasDe } from "@/lib/huellas";
import { decidir } from "@/lib/reconocer";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";
import { Reconocer } from "@/modules/reconocer";

type Escaneo =
  | { fase: "listo" }
  | { fase: "analizando" }
  /** Lo reconoció: se muestra con su cantidad para corregirla. */
  | { fase: "encontrado"; producto: Producto; otros: Producto[]; foto: Foto }
  /** Duda entre varios (o el usuario dijo "no es este"). */
  | { fase: "dudoso"; opciones: Producto[]; sugerencia: string; foto: Foto }
  /** No se parece a nada del inventario: se ofrece agregarlo. */
  | { fase: "nuevo"; sugerencia: string; foto: Foto }
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
export default function Camara() {
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
  const [huellas, setHuellas] = useState<Record<string, string>>({});
  const [preparando, setPreparando] = useState<{ hechas: number; total: number } | null>(null);
  const clave = productosActivos.map((p) => `${p.id}:${p.foto_path ?? ""}`).join(",");
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
      const tomada = await camara.current.takePictureAsync({ quality: 0.5, base64: true });
      if (!tomada?.base64) throw new Error("No se pudo sacar la foto.");
      const foto = { uri: tomada.uri, base64: tomada.base64 };
      const { distancias, textos } = await Reconocer.analizar(foto.uri, huellas);
      const v = decidir(candidatos, distancias, textos);
      const elegido = v.producto ? porId(v.producto.id) : undefined;
      const otros = v.alternativas.map((a) => porId(a.id)).filter((p): p is Producto => !!p);

      if (elegido) {
        vibrar(Haptics.NotificationFeedbackType.Success);
        setEscaneo({ fase: "encontrado", producto: elegido, otros, foto });
      } else if (otros.length) {
        vibrar(Haptics.NotificationFeedbackType.Warning);
        setEscaneo({ fase: "dudoso", opciones: otros, sugerencia: v.sugerencia, foto });
      } else {
        vibrar(Haptics.NotificationFeedbackType.Warning);
        setEscaneo({ fase: "nuevo", sugerencia: v.sugerencia, foto });
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
  const pista =
    escaneo.fase === "analizando"
      ? "Reconociendo…"
      : preparando
        ? `Preparando las fotos de tus productos (${preparando.hechas}/${preparando.total})…`
        : !productosActivos.length
          ? permisos.gestionar_fotos
            ? "Apuntá a un producto: si no está, lo agregás con esta foto"
            : "Apuntá a un producto: si no está, lo podés agregar"
          : sinFoto
            ? `Apuntá a un producto · ${sinFoto} sin foto se reconocen solo por la etiqueta`
            : "Apuntá a un producto y tocá el disparador";

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
            {activo?.nombre ?? "Sin inventario"}
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
            onElegir={(producto, foto) =>
              setEscaneo({ fase: "encontrado", producto, otros: [], foto })
            }
            onNoEs={(e) =>
              setEscaneo({
                fase: "dudoso",
                opciones: e.otros,
                sugerencia: "",
                foto: e.foto,
              })
            }
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
  onElegir,
  onNoEs,
  onAgregar,
  onCerrar,
}: {
  escaneo: EscaneoConResultado;
  puedeAgregar: boolean;
  puedeAjustar: boolean;
  onElegir: (p: Producto, foto: Foto) => void;
  onNoEs: (e: Extract<Escaneo, { fase: "encontrado" }>) => void;
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
                    ? "Se parece a estos. Elegí el correcto."
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
            {puedeAgregar ? (
              <BotonPrincipal
                variante="gris"
                onPress={() => onAgregar(escaneo.sugerencia, escaneo.foto)}
              >
                Es otro: agregar producto
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
  cerrar,
  onNoEs,
  onCerrar,
}: {
  escaneo: Extract<Escaneo, { fase: "encontrado" }>;
  editable: boolean;
  cerrar: React.ReactNode;
  onNoEs: () => void;
  onCerrar: () => void;
}) {
  const t = useTema();
  const { categoriasActivas } = useInventario();
  const { ajustarDesdeCamara } = useAcciones();
  const { producto } = escaneo;
  const [cantidad, setCantidad] = useState(producto.cantidad);
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
    <FotoProducto ruta={producto.foto_path} tam={44} version={producto.actualizado_en} />
  ) : (
    <View style={[s.miniatura, { backgroundColor: t.relleno }]}>
      <Icono sf="shippingbox" ion="cube-outline" size={20} color={t.textoSec} />
    </View>
  );
}

const s = StyleSheet.create({
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
