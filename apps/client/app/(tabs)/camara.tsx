import type { LedColor, Producto } from "@mi-desorden/core";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
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
import { BotonPrincipal, BotonVidrio, Icono, tocar, Vidrio } from "@/components/ui";
import { useStore } from "@/lib/store";
import { colorLed, tipo, useTema } from "@/lib/theme";

const LEDS: LedColor[] = ["verde", "azul", "amarillo", "rojo", "violeta"];

type Escaneo =
  | { fase: "listo" }
  | { fase: "buscando" }
  | { fase: "encontrado"; producto: Producto }
  | { fase: "nada" };

/**
 * Visor de la cámara. El reconocimiento real todavía no existe (ver
 * docs/DECISIONES.md): por ahora elige un producto del inventario que tenga el
 * LED seleccionado, para poder mostrar el flujo completo en la demo.
 */
export default function Camara() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const enFoco = useIsFocused();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const { activo, productosActivos, confirmarDeteccion, enVivo } = useStore();
  const [led, setLed] = useState<LedColor>("verde");
  const [linterna, setLinterna] = useState(false);
  const [escaneo, setEscaneo] = useState<Escaneo>({ fase: "listo" });

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
          La usamos para reconocer los productos de tu estantería según el color de su LED. No se
          guarda ninguna foto.
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

  function escanear() {
    if (escaneo.fase === "buscando") return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setEscaneo({ fase: "buscando" });
    setTimeout(() => {
      const candidatos = productosActivos.filter((p) => p.led === led);
      const producto = candidatos[Math.floor(Math.random() * candidatos.length)];
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          producto
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      }
      setEscaneo(producto ? { fase: "encontrado", producto } : { fase: "nada" });
    }, 1300);
  }

  const abajo = insets.bottom + (Platform.OS === "ios" ? 12 : 72);

  return (
    <View style={s.fondo}>
      {enFoco ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={linterna} />
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
        <Visor color={colorLed(t, led)} buscando={escaneo.fase === "buscando"} />
      </View>

      {/* Abajo: resultado, selector de LED y disparador */}
      <View style={[s.abajo, { bottom: abajo }]}>
        {escaneo.fase === "encontrado" || escaneo.fase === "nada" ? (
          <Resultado
            escaneo={escaneo}
            onConfirmar={(p) => {
              confirmarDeteccion(p.id).catch(() => {});
              setEscaneo({ fase: "listo" });
            }}
            onCerrar={() => setEscaneo({ fase: "listo" })}
          />
        ) : (
          <Vidrio claro style={s.pista}>
            <Text style={[tipo.nota, s.textoClaro]}>
              {escaneo.fase === "buscando"
                ? `Buscando el LED ${led}…`
                : "Apuntá a la estantería y tocá el disparador"}
            </Text>
          </Vidrio>
        )}

        <Vidrio claro style={s.leds}>
          {LEDS.map((c) => {
            const activo = c === led;
            return (
              <Pressable
                key={c}
                accessibilityLabel={`Buscar LED ${c}`}
                accessibilityState={{ selected: activo }}
                onPress={() => (tocar(), setLed(c))}
                style={[s.ledAnillo, { borderColor: activo ? "#fff" : "transparent" }]}
              >
                <View style={[s.led, { backgroundColor: colorLed(t, c) }]} />
              </Pressable>
            );
          })}
        </Vidrio>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reconocer"
          onPress={escanear}
          style={({ pressed }) => [s.disparador, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
        >
          <View style={s.disparadorInterior}>
            {escaneo.fase === "buscando" ? <ActivityIndicator color="#000" /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function Visor({ color, buscando }: { color: string; buscando: boolean }) {
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
    <View style={[s.esquina, { borderColor: buscando ? color : "#fff" }, pos]} />
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

function Resultado({
  escaneo,
  onConfirmar,
  onCerrar,
}: {
  escaneo: Extract<Escaneo, { fase: "encontrado" } | { fase: "nada" }>;
  onConfirmar: (p: Producto) => void;
  onCerrar: () => void;
}) {
  const t = useTema();
  const entrada = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(entrada, {
      toValue: 1,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
    }).start();
  }, [entrada]);

  const estilo = {
    opacity: entrada,
    transform: [{ translateY: entrada.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
  };

  return (
    <Animated.View style={[{ width: "100%", maxWidth: 420 }, estilo]}>
      <Vidrio style={s.tarjeta}>
        {escaneo.fase === "encontrado" ? (
          <>
            <View style={s.tarjetaFila}>
              <View style={[s.ledGrande, { backgroundColor: colorLed(t, escaneo.producto.led) }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[tipo.destacado, { color: t.texto }]} numberOfLines={1}>
                  {escaneo.producto.nombre}
                </Text>
                <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
                  Estante {escaneo.producto.ubicacion} · {escaneo.producto.cantidad} en inventario
                </Text>
              </View>
              <BotonVidrio etiqueta="Cerrar" sf="xmark" ion="close" tam={32} onPress={onCerrar} />
            </View>
            <BotonPrincipal onPress={() => onConfirmar(escaneo.producto)}>
              Confirmar ubicación
            </BotonPrincipal>
          </>
        ) : (
          <View style={s.tarjetaFila}>
            <Icono
              sf="questionmark.circle"
              ion="help-circle-outline"
              size={28}
              color={t.textoSec}
            />
            <View style={{ flex: 1 }}>
              <Text style={[tipo.destacado, { color: t.texto }]}>Nada con ese LED</Text>
              <Text style={[tipo.nota, { color: t.textoSec }]}>
                Ningún producto de este inventario usa ese color.
              </Text>
            </View>
            <BotonVidrio etiqueta="Cerrar" sf="xmark" ion="close" tam={32} onPress={onCerrar} />
          </View>
        )}
      </Vidrio>
    </Animated.View>
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
  pista: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  leds: { flexDirection: "row", gap: 6, padding: 6, borderRadius: 30 },
  ledAnillo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  led: { width: 28, height: 28, borderRadius: 14 },
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
  tarjeta: { borderRadius: 30, padding: 16, gap: 14 },
  tarjetaFila: { flexDirection: "row", alignItems: "center", gap: 12 },
  ledGrande: { width: 32, height: 32, borderRadius: 16 },
});
