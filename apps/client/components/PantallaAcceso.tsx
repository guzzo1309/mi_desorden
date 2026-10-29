import Constants from "expo-constants";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type TextInputInstance,
  type TextInputProps,
  type ViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icono, tocar, type SFSymbol } from "@/components/ui";
import { useSesion } from "@/lib/store";
import { useTema, type Tema } from "@/lib/theme";
import { PanelMarca } from "@/components/PanelMarca";
import { useEsAncho } from "@/lib/pantalla";

export type Modo = "login" | "registro";

const ICONO = 84;
const BEZ_SALIDA = Easing.bezier(0.2, 0.9, 0.2, 1);
const BEZ_REBOTE = Easing.bezier(0.34, 1.56, 0.64, 1);
const BEZ_VUELTA = Easing.bezier(0.65, 0, 0.2, 1);
const BEZ_SEG = Easing.bezier(0.3, 0.9, 0.3, 1);
const CONTEO = 128;

let introVista = false;

/** 0 = vacía, 1 débil, 2 aceptable, 3 buena, 4 muy buena. */
export function fuerzaClave(c: string) {
  let n = 0;
  if (c.length >= 6) n++;
  if (c.length >= 10) n++;
  if (/[A-Z]/.test(c) && /[a-z]/.test(c)) n++;
  if (/\d/.test(c) && /[^A-Za-z0-9]/.test(c)) n++;
  return c.length ? Math.max(1, n) : 0;
}

const t0 = (ms: number, fn: () => void) => setTimeout(fn, ms);

export function PantallaAcceso({ modoInicial }: { modoInicial: Modo }) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { height: alto } = useWindowDimensions();
  const ancho = useEsAncho();
  const { iniciarSesion, registrar } = useSesion();

  const [modo, setModo] = useState<Modo>(modoInicial);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [ver, setVer] = useState(false);
  const [foco, setFoco] = useState<"nombre" | "email" | "clave" | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState(introVista ? CONTEO : 0);

  const reg = modo === "registro";
  const listo = reg
    ? nombre.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim()) && clave.length >= 6
    : email.includes("@") && clave.length >= 6;

  /* ---------- intro ---------- */
  const v = useRef({
    iconoO: new Animated.Value(introVista ? 1 : 0),
    iconoS: new Animated.Value(introVista ? 1 : 0.55),
    iconoY: new Animated.Value(0),
    marcoO: new Animated.Value(0),
    marcoS: new Animated.Value(1.7),
    lineaY: new Animated.Value(-20),
    lineaO: new Animated.Value(0),
    cuentaO: new Animated.Value(0),
    // título, subtítulo, selector, formulario, botón
    filas: [0, 1, 2, 3, 4].map(() => new Animated.Value(introVista ? 1 : 0)),
  }).current;
  const [centro, setCentro] = useState<number | null>(null);
  const iconoRef = useRef<ViewInstance>(null);

  useEffect(() => {
    if (introVista || centro === null) return;
    introVista = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => timers.push(t0(ms, fn));
    const tiempo = (
      val: Animated.Value,
      toValue: number,
      duration: number,
      easing = BEZ_SALIDA,
      delay = 0,
    ) => Animated.timing(val, { toValue, duration, easing, delay, useNativeDriver: true });
    /** Fila i que entra con `orden` dentro de su grupo (70 ms entre cada una, como el diseño). */
    const fila = (i: number, orden: number) => tiempo(v.filas[i]!, 1, 620, BEZ_SALIDA, orden * 70);

    let cancelado = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
      if (cancelado) return;
      if (reducir) {
        v.iconoO.setValue(1);
        v.iconoS.setValue(1);
        v.filas.forEach((f) => f.setValue(1));
        setCuenta(CONTEO);
        return;
      }
      // Fase 1: el ícono aparece agrandado en el centro de la pantalla.
      v.iconoY.setValue(centro);
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
      // Fase 3: se apaga el escáner y el ícono sube a su lugar; entran título y subtítulo.
      en(1850, () => {
        Animated.parallel([
          tiempo(v.marcoO, 0, 300, Easing.ease),
          tiempo(v.lineaO, 0, 200, Easing.ease),
          tiempo(v.cuentaO, 0, 300, Easing.ease),
          tiempo(v.iconoY, 0, 720, BEZ_VUELTA),
          tiempo(v.iconoS, 1, 720, BEZ_VUELTA),
          fila(0, 0),
          fila(1, 1),
        ]).start();
      });
      // Fase 4: selector, formulario y botón, escalonados.
      en(2250, () => Animated.parallel([fila(2, 0), fila(3, 1), fila(4, 2)]).start());
    });
    return () => {
      cancelado = true;
      timers.forEach((x) => {
        clearTimeout(x);
        clearInterval(x as unknown as ReturnType<typeof setInterval>);
      });
    };
  }, [centro, v]);

  /** Distancia desde el lugar final del ícono hasta el centro de la pantalla. */
  function medirIcono() {
    if (introVista || centro !== null) return;
    iconoRef.current?.measureInWindow((_x, y) => setCentro(alto / 2 - (y + ICONO / 2)));
  }

  const entrada = (i: number) => ({
    opacity: v.filas[i],
    transform: [
      { translateY: v.filas[i]!.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
    ],
  });

  /* ---------- modo: selector, subtítulo y campo nombre ---------- */
  const modoV = useRef(new Animated.Value(reg ? 1 : 0)).current; // nativo: selector y subtítulo
  const nombreV = useRef(new Animated.Value(reg ? 1 : 0)).current; // JS: alto del campo nombre
  const [anchoSeg, setAnchoSeg] = useState(0);

  useEffect(() => {
    Animated.timing(modoV, {
      toValue: reg ? 1 : 0,
      duration: 320,
      easing: BEZ_SEG,
      useNativeDriver: true,
    }).start();
    Animated.timing(nombreV, {
      toValue: reg ? 1 : 0,
      duration: 380,
      easing: BEZ_SEG,
      useNativeDriver: false,
    }).start();
  }, [reg, modoV, nombreV]);

  function cambiarModo(m: Modo) {
    if (m === modo) return;
    tocar();
    setModo(m);
    setError(null);
  }

  /* ---------- envío ---------- */
  const sacudida = useRef(new Animated.Value(0)).current;
  function sacudir() {
    Animated.sequence(
      [-8, 8, -6, 6, -3, 0].map((x) =>
        Animated.timing(sacudida, {
          toValue: x,
          duration: 55,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    ).start();
    if (Platform.OS !== "web")
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }

  async function enviar() {
    if (!listo || cargando) return;
    setError(null);
    setCargando(true);
    const correo = email.trim().toLowerCase();
    try {
      if (reg) {
        // Si Supabase no pide confirmar el correo, la sesión arranca sola y el guard navega.
        if (await registrar(nombre, email, clave)) {
          router.replace({ pathname: "/confirmar", params: { email: correo, origen: "registro" } });
        }
      } else {
        await iniciarSesion(email, clave);
      }
    } catch (e) {
      const mensaje = (e as Error).message;
      setCargando(false);
      // Cuenta creada pero sin confirmar: a la pantalla del código.
      if (/confirmá tu correo/i.test(mensaje)) {
        router.push({ pathname: "/confirmar", params: { email: correo } });
        return;
      }
      setError(mensaje);
      sacudir();
    }
  }

  /* ---------- campos ---------- */
  const emailRef = useRef<TextInputInstance>(null);
  const claveRef = useRef<TextInputInstance>(null);
  const colorIcono = (k: typeof foco) =>
    foco === k ? t.tinte : t.oscuro ? "rgba(235,235,245,0.35)" : "rgba(60,60,67,0.35)";
  const anillo = error
    ? { borde: hexA(t.rojo, 0.6), halo: hexA(t.rojo, 0.1) }
    : foco
      ? { borde: hexA(t.tinte, 0.55), halo: hexA(t.tinte, 0.12) }
      : { borde: "transparent", halo: "transparent" };

  const f = fuerzaClave(clave);
  const colorFuerza = [t.rojo, t.tinte, t.amarillo, t.verde][f - 1];
  const textoFuerza =
    clave.length === 0
      ? "La contraseña necesita al menos 6 caracteres."
      : clave.length < 6
        ? `Faltan ${6 - clave.length} caracteres.`
        : `Seguridad: ${["débil", "aceptable", "buena", "muy buena"][f - 1]}.`;

  const s = estilos(t);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.fondo, flexDirection: ancho ? "row" : "column" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {ancho && <PanelMarca />}
      {/* Resplandor naranja arriba */}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            experimental_backgroundImage: `radial-gradient(110% 55% at 50% 0%, ${hexA(t.tinte, t.oscuro ? 0.18 : 0.13)}, ${hexA(t.tinte, 0)} 62%)`,
          },
        ]}
      />
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.contenido,
          { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 56 },
        ]}
      >
        <View style={s.columna}>
          {/* Marca */}
          <View style={s.marca}>
            <Animated.View
              ref={iconoRef}
              onLayout={medirIcono}
              style={[
                s.iconoCaja,
                {
                  opacity: centro === null && !introVista ? 0 : v.iconoO,
                  transform: [{ translateY: v.iconoY }, { scale: v.iconoS }],
                },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[s.marco, { opacity: v.marcoO, transform: [{ scale: v.marcoS }] }]}
              >
                {(["tl", "tr", "bl", "br"] as const).map((e) => (
                  <View key={e} style={[s.esquina, esquina(e, t.tinte)]} />
                ))}
              </Animated.View>
              <View style={[s.icono, { backgroundColor: t.tinte, shadowColor: t.tinte }]}>
                <Icono sf="shippingbox.fill" ion="cube" size={40} color="#fff" weight="semibold" />
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

            <Animated.Text style={[s.titulo, { color: t.texto }, entrada(0)]}>
              mi_desorden
            </Animated.Text>
            <Animated.View style={[s.subtituloCaja, entrada(1)]}>
              <Animated.Text
                style={[
                  s.subtitulo,
                  { color: t.textoSec },
                  { opacity: modoV.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
                  {
                    transform: [
                      {
                        translateY: modoV.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }),
                      },
                    ],
                  },
                ]}
              >
                Tu inventario, contado por la cámara.
              </Animated.Text>
              <Animated.Text
                style={[
                  s.subtitulo,
                  { color: t.textoSec },
                  { opacity: modoV },
                  {
                    transform: [
                      {
                        translateY: modoV.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                      },
                    ],
                  },
                ]}
              >
                Respaldá tu inventario y compartilo con tu equipo.
              </Animated.Text>
            </Animated.View>
          </View>

          <View style={{ gap: 14 }}>
            {/* Selector Iniciar sesión / Crear cuenta */}
            <Animated.View
              style={[s.selector, { backgroundColor: t.relleno }, entrada(2)]}
              onLayout={(e) => setAnchoSeg((e.nativeEvent.layout.width - 4) / 2)}
            >
              <Animated.View
                style={[
                  s.selectorPulgar,
                  { width: anchoSeg, backgroundColor: t.oscuro ? "#636366" : "#fff" },
                  {
                    transform: [
                      {
                        translateX: modoV.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, anchoSeg],
                        }),
                      },
                    ],
                  },
                ]}
              />
              {(["login", "registro"] as const).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: modo === m }}
                  onPress={() => cambiarModo(m)}
                  style={s.selectorOpcion}
                >
                  <Text
                    style={[
                      s.selectorTexto,
                      { color: t.texto, fontWeight: modo === m ? "600" : "500" },
                    ]}
                  >
                    {m === "login" ? "Iniciar sesión" : "Crear cuenta"}
                  </Text>
                </Pressable>
              ))}
            </Animated.View>

            {/* Formulario */}
            <Animated.View style={[{ gap: 6 }, entrada(3)]}>
              <View style={[s.halo, { borderColor: anillo.halo }]}>
                <Animated.View
                  style={[
                    s.grupo,
                    {
                      backgroundColor: t.celda,
                      borderColor: anillo.borde,
                      transform: [{ translateX: sacudida }],
                    },
                  ]}
                >
                  <Animated.View
                    style={{
                      overflow: "hidden",
                      height: nombreV.interpolate({ inputRange: [0, 1], outputRange: [0, 53] }),
                      opacity: nombreV,
                    }}
                  >
                    <Campo
                      t={t}
                      sf="person"
                      ion="person-outline"
                      colorIcono={colorIcono("nombre")}
                      placeholder="Nombre"
                      value={nombre}
                      onChangeText={(x) => (setNombre(x), setError(null))}
                      onFocus={() => setFoco("nombre")}
                      onBlur={() => setFoco(null)}
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                      editable={reg}
                    />
                    <View style={[s.separador, { backgroundColor: t.separador }]} />
                  </Animated.View>
                  <Campo
                    ref={emailRef}
                    t={t}
                    sf="envelope"
                    ion="mail-outline"
                    colorIcono={colorIcono("email")}
                    placeholder="Correo"
                    value={email}
                    onChangeText={(x) => (setEmail(x), setError(null))}
                    onFocus={() => setFoco("email")}
                    onBlur={() => setFoco(null)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => claveRef.current?.focus()}
                  />
                  <View style={[s.separador, { backgroundColor: t.separador }]} />
                  <Campo
                    ref={claveRef}
                    t={t}
                    sf="lock"
                    ion="lock-closed-outline"
                    colorIcono={colorIcono("clave")}
                    placeholder="Contraseña"
                    value={clave}
                    onChangeText={(x) => (setClave(x), setError(null))}
                    onFocus={() => setFoco("clave")}
                    onBlur={() => setFoco(null)}
                    secureTextEntry={!ver}
                    // Con la contraseña visible, iOS la trata como texto común:
                    // ponía mayúscula a la primera letra y autocorregía.
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    textContentType={reg ? "newPassword" : "password"}
                    autoComplete={reg ? "new-password" : "current-password"}
                    returnKeyType="go"
                    onSubmitEditing={enviar}
                    derecha={
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={ver ? "Ocultar contraseña" : "Mostrar contraseña"}
                        hitSlop={6}
                        onPress={() => (tocar(), setVer((x) => !x))}
                        style={({ pressed }) => [s.ojo, pressed && { backgroundColor: t.relleno }]}
                      >
                        <Icono
                          sf={ver ? "eye.slash" : "eye"}
                          ion={ver ? "eye-off-outline" : "eye-outline"}
                          size={20}
                          color={t.oscuro ? "rgba(235,235,245,0.45)" : "rgba(60,60,67,0.45)"}
                        />
                      </Pressable>
                    }
                  />
                </Animated.View>
              </View>

              <View style={[s.pie, { gap: 6 }]}>
                {error ? (
                  <View style={s.error} accessibilityLiveRegion="polite">
                    <Icono
                      sf="exclamationmark.circle.fill"
                      ion="alert-circle"
                      size={15}
                      color={t.rojo}
                    />
                    <Text style={[s.pieTexto, { color: t.rojo, flex: 1 }]}>{error}</Text>
                  </View>
                ) : null}
                {/* Con error en el registro, el error alcanza; al iniciar sesión el
                    enlace para recuperar la clave sigue a mano (es cuando más sirve). */}
                {error && reg ? null : reg ? (
                  <View style={{ gap: 6 }}>
                    <View style={s.barras}>
                      {[1, 2, 3, 4].map((i) => (
                        <View
                          key={i}
                          style={[s.barra, { backgroundColor: f >= i ? colorFuerza : t.relleno }]}
                        />
                      ))}
                    </View>
                    <Text style={[s.pieTexto, { color: t.textoSec }]}>{textoFuerza}</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Pressable
                      hitSlop={8}
                      onPress={() =>
                        router.push({
                          pathname: "/recuperar",
                          params: { email: email.trim().toLowerCase() },
                        })
                      }
                    >
                      <Text style={[s.pieTexto, { color: t.tinte, fontWeight: "600" }]}>
                        ¿Olvidaste tu contraseña?
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Botón y cambio de modo */}
            <Animated.View style={[{ gap: 18 }, entrada(4)]}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !listo, busy: cargando }}
                onPress={() => (tocar(), enviar())}
                disabled={cargando}
                style={({ pressed }) => [
                  s.boton,
                  {
                    backgroundColor: t.tinte,
                    shadowColor: t.tinte,
                    opacity: listo ? 1 : 0.4,
                    transform: [{ scale: pressed && listo ? 0.98 : 1 }],
                  },
                ]}
              >
                {cargando ? (
                  <Girador />
                ) : (
                  <>
                    <Text style={s.botonTexto}>{reg ? "Continuar" : "Iniciar sesión"}</Text>
                    <Icono
                      sf="arrow.right"
                      ion="arrow-forward"
                      size={18}
                      color="#fff"
                      weight="semibold"
                    />
                  </>
                )}
              </Pressable>
              <Text style={[s.cambio, { color: t.textoSec }]}>
                {reg ? "¿Ya tenés cuenta?" : "¿No tenés cuenta?"}{" "}
                <Text
                  onPress={() => cambiarModo(reg ? "login" : "registro")}
                  style={{ color: t.tinte, fontWeight: "600" }}
                >
                  {reg ? "Iniciar sesión" : "Crear una"}
                </Text>
              </Text>
            </Animated.View>
          </View>
        </View>
      </ScrollView>

      <Animated.Text
        pointerEvents="none"
        style={[s.version, { color: t.textoTer, bottom: insets.bottom + 8, opacity: v.filas[4] }]}
      >
        v{Constants.expoConfig?.version ?? "0.1.0"}
      </Animated.Text>
    </KeyboardAvoidingView>
  );
}

/* ---------- piezas ---------- */

function Campo({
  t,
  sf,
  ion,
  colorIcono,
  derecha,
  ref,
  ...props
}: TextInputProps & {
  t: Tema;
  sf: SFSymbol;
  ion: Parameters<typeof Icono>[0]["ion"];
  colorIcono: string;
  derecha?: React.ReactNode;
  ref?: React.Ref<TextInputInstance>;
}) {
  return (
    <View style={[campo.fila, derecha ? { paddingRight: 10 } : null]}>
      <Icono sf={sf} ion={ion} size={20} color={colorIcono} />
      <TextInput
        ref={ref}
        placeholderTextColor={t.textoTer}
        selectionColor={t.tinte}
        style={[campo.input, { color: t.texto }]}
        {...props}
      />
      {derecha}
    </View>
  );
}

function Girador() {
  const giro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(giro, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    a.start();
    return () => a.stop();
  }, [giro]);
  return (
    <Animated.View
      style={[
        campo.girador,
        {
          transform: [
            { rotate: giro.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
          ],
        },
      ]}
    />
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

const campo = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
  },
  input: { flex: 1, minWidth: 0, fontSize: 17, letterSpacing: -0.4, paddingVertical: 0 },
  girador: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.35)",
    borderTopColor: "#fff",
  },
});

function estilos(t: Tema) {
  return StyleSheet.create({
    contenido: { flexGrow: 1, paddingHorizontal: 20 },
    columna: { width: "100%", maxWidth: 420, alignSelf: "center", gap: 28 },
    marca: { alignItems: "center", gap: 8 },
    iconoCaja: { width: ICONO, height: ICONO, marginBottom: 12, zIndex: 3 },
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
    titulo: { fontSize: 30, fontWeight: "700", letterSpacing: -0.6 },
    subtituloCaja: { height: 44, width: "100%" },
    subtitulo: {
      position: "absolute",
      left: 0,
      right: 0,
      textAlign: "center",
      fontSize: 17,
      lineHeight: 22,
      letterSpacing: -0.4,
    },
    selector: { flexDirection: "row", height: 36, padding: 2, borderRadius: 10 },
    selectorPulgar: {
      position: "absolute",
      top: 2,
      bottom: 2,
      left: 2,
      borderRadius: 8,
      shadowColor: "#000",
      shadowOpacity: t.oscuro ? 0 : 0.1,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },
    selectorOpcion: { flex: 1, alignItems: "center", justifyContent: "center" },
    selectorTexto: { fontSize: 13, letterSpacing: -0.1 },
    halo: { borderRadius: 32.5, borderWidth: 5, margin: -6.5 },
    grupo: { borderRadius: 27.5, borderWidth: 1.5, overflow: "hidden" },
    separador: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
    ojo: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    pie: { minHeight: 34, paddingTop: 2, paddingHorizontal: 16 },
    error: { flexDirection: "row", alignItems: "center", gap: 6 },
    pieTexto: { fontSize: 13, letterSpacing: -0.1 },
    barras: { flexDirection: "row", gap: 4 },
    barra: { flex: 1, height: 4, borderRadius: 2 },
    boton: {
      height: 52,
      borderRadius: 26,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      shadowOpacity: 0.28,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 6 },
    },
    botonTexto: { color: "#fff", fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
    cambio: { textAlign: "center", fontSize: 15, letterSpacing: -0.2 },
    version: { position: "absolute", left: 0, right: 0, textAlign: "center", fontSize: 12 },
  });
}
