import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Icono } from "@/components/ui";
import { useTema } from "@/lib/theme";

/**
 * Presentación al abrir la app con la sesión ya iniciada: la misma intro de la pantalla
 * de acceso (ícono, escáner y contador), superpuesta a la app mientras carga; al final
 * se desvanece. Sin sesión, la intro la hace la propia pantalla de acceso.
 */

const ICONO = 84;
const CONTEO = 128;
const BEZ_SALIDA = Easing.bezier(0.2, 0.9, 0.2, 1);
const BEZ_REBOTE = Easing.bezier(0.34, 1.56, 0.64, 1);
const BEZ_VUELTA = Easing.bezier(0.65, 0, 0.2, 1);

let vista = false;

/** Si ya se mostró en este arranque de la app. */
export function presentacionVista() {
  return vista;
}

export function Presentacion({ onFin }: { onFin: () => void }) {
  const t = useTema();
  const [cuenta, setCuenta] = useState(0);
  const v = useRef({
    fondoO: new Animated.Value(1),
    iconoO: new Animated.Value(0),
    iconoS: new Animated.Value(0.55),
    marcoO: new Animated.Value(0),
    marcoS: new Animated.Value(1.7),
    lineaY: new Animated.Value(-20),
    lineaO: new Animated.Value(0),
    cuentaO: new Animated.Value(0),
  }).current;
  const fin = useRef(onFin);
  fin.current = onFin;

  useEffect(() => {
    vista = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const tiempo = (
      val: Animated.Value,
      toValue: number,
      duration: number,
      easing = BEZ_SALIDA,
      delay = 0,
    ) => Animated.timing(val, { toValue, duration, easing, delay, useNativeDriver: true });
    const salir = (ms: number) =>
      Animated.timing(v.fondoO, {
        toValue: 0,
        duration: ms,
        easing: Easing.ease,
        useNativeDriver: true,
      }).start(() => fin.current());

    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (cancelado) return;
      if (reducir) {
        v.iconoO.setValue(1);
        v.iconoS.setValue(1);
        en(600, () => salir(250));
        return;
      }
      // Fase 1: el ícono aparece agrandado en el centro.
      en(80, () =>
        Animated.parallel([
          tiempo(v.iconoO, 1, 300, Easing.ease),
          tiempo(v.iconoS, 1.3, 650, BEZ_REBOTE),
        ]).start(),
      );
      // Fase 2: marco de escáner, línea que barre y contador.
      en(700, () => {
        Animated.parallel([
          tiempo(v.marcoO, 1, 350, Easing.ease),
          tiempo(v.marcoS, 1, 650),
          tiempo(v.lineaO, 1, 200, Easing.ease),
          tiempo(v.lineaY, 104, 1000, Easing.bezier(0.45, 0, 0.55, 1), 120),
          tiempo(v.cuentaO, 1, 300, Easing.ease),
        ]).start();
        const inicio = Date.now();
        const iv = setInterval(() => {
          const k = Math.min(1, (Date.now() - inicio) / 950);
          setCuenta(Math.round(CONTEO * (1 - Math.pow(1 - k, 3))));
          if (k >= 1) clearInterval(iv);
        }, 30);
        timers.push(iv as unknown as ReturnType<typeof setTimeout>);
        if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
      });
      // Fase 3: se apaga el escáner y todo se desvanece hacia la app.
      en(1850, () => {
        Animated.parallel([
          tiempo(v.marcoO, 0, 300, Easing.ease),
          tiempo(v.lineaO, 0, 200, Easing.ease),
          tiempo(v.cuentaO, 0, 300, Easing.ease),
          tiempo(v.iconoS, 1, 520, BEZ_VUELTA),
        ]).start();
      });
      en(2150, () => salir(380));
    });
    return () => {
      cancelado = true;
      timers.forEach((x) => {
        clearTimeout(x);
        clearInterval(x as unknown as ReturnType<typeof setInterval>);
      });
    };
  }, [v]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, s.capa, { backgroundColor: t.fondo, opacity: v.fondoO }]}
    >
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `radial-gradient(110% 55% at 50% 0%, ${hexA(t.tinte, t.oscuro ? 0.18 : 0.13)}, ${hexA(t.tinte, 0)} 62%)`,
          },
        ]}
      />
      <Animated.View style={[s.iconoCaja, { opacity: v.iconoO, transform: [{ scale: v.iconoS }] }]}>
        <Animated.View
          pointerEvents="none"
          style={[s.marco, { opacity: v.marcoO, transform: [{ scale: v.marcoS }] }]}
        >
          {(["tl", "tr", "bl", "br"] as const).map((e) => (
            <View key={e} style={[s.esquina, esquina(e, t.tinte)]} />
          ))}
        </Animated.View>
        <View style={[s.icono, { backgroundColor: t.tinte, shadowColor: t.tinte }]}>
          <Icono
            sf="shippingbox.fill"
            ion="cube"
            size={40}
            color={t.sobreTinte}
            weight="semibold"
          />
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            s.linea,
            {
              backgroundColor: t.tinte,
              shadowColor: t.tinte,
              opacity: v.lineaO,
              transform: [{ translateY: v.lineaY }],
            },
          ]}
        />
        <Animated.Text style={[s.contador, { color: t.textoSec, opacity: v.cuentaO }]}>
          CONTANDO · <Text style={{ color: t.texto }}>{String(cuenta).padStart(3, "0")}</Text>
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

/** #RRGGBB + alpha → rgba(). */
function hexA(hex: string, a: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function esquina(e: "tl" | "tr" | "bl" | "br", color: string) {
  const b = { borderColor: color };
  return {
    tl: { ...b, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
    tr: { ...b, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
    bl: {
      ...b,
      bottom: 0,
      left: 0,
      borderBottomWidth: 3,
      borderLeftWidth: 3,
      borderBottomLeftRadius: 8,
    },
    br: {
      ...b,
      bottom: 0,
      right: 0,
      borderBottomWidth: 3,
      borderRightWidth: 3,
      borderBottomRightRadius: 8,
    },
  }[e];
}

const s = StyleSheet.create({
  capa: { zIndex: 100, elevation: 100, alignItems: "center", justifyContent: "center" },
  iconoCaja: { width: ICONO, height: ICONO },
  icono: {
    width: ICONO,
    height: ICONO,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 8 },
  },
  marco: { position: "absolute", top: -20, left: -20, right: -20, bottom: -20 },
  esquina: { position: "absolute", width: 22, height: 22 },
  linea: {
    position: "absolute",
    left: -26,
    right: -26,
    top: 0,
    height: 2,
    borderRadius: 2,
    shadowOpacity: 0.55,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  contador: {
    position: "absolute",
    top: 122,
    left: -60,
    right: -60,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 1.2,
    fontFamily: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
});
