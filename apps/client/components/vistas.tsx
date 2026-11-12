import type { Inventario } from "@mi-desorden/core";
import {
  Button,
  Host,
  HStack,
  Image as ImagenSF,
  Menu,
  Picker,
  Section,
  Text as TextoSF,
} from "@/components/swiftui";
import { font, foregroundStyle, kerning, lineLimit, pickerStyle, tag } from "@/components/swiftui";
import { useQuery } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { productos as productosApi } from "@/api";
import { ANCHO_LECTURA, Icono, tocar, Vidrio } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { useTema, fuenteMarca } from "@/lib/theme";
import { menuWeb } from "@/web/dialogos";

/**
 * Piezas del rediseño de las vistas principales (Claude Design · "Vistas
 * Principales"): encabezado grande, píldoras de inventario, selector con
 * pulgar deslizante, secciones blancas y la entrada escalonada al cambiar de tab.
 */

/** Estilo que puede traer valores animados (el de la entrada escalonada). */
export type EstiloAnimado = Animated.WithAnimatedValue<StyleProp<ViewStyle>>;

const BEZ_SALIDA = Easing.bezier(0.2, 0.9, 0.2, 1);
const BEZ_SEG = Easing.bezier(0.3, 0.9, 0.3, 1);

/**
 * Entrada escalonada: cada bloque sube 14 px y aparece, 60 ms después del
 * anterior. Se repite cada vez que la tab gana el foco, como en el diseño.
 */
export function useEntrada(bloques: number) {
  const valores = useRef(Array.from({ length: bloques }, () => new Animated.Value(0))).current;
  useFocusEffect(
    useCallback(() => {
      let vivo = true;
      AccessibilityInfo.isReduceMotionEnabled().then((reducir) => {
        if (!vivo) return;
        if (reducir) return valores.forEach((v) => v.setValue(1));
        valores.forEach((v) => v.setValue(0));
        Animated.stagger(
          60,
          valores.map((v) =>
            Animated.timing(v, {
              toValue: 1,
              duration: 560,
              easing: BEZ_SALIDA,
              useNativeDriver: true,
            }),
          ),
        ).start();
      });
      return () => {
        vivo = false;
      };
    }, [valores]),
  );
  return (i: number) => ({
    opacity: valores[i],
    transform: [
      { translateY: valores[i]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
    ],
  });
}

/** Cuántos puntos de scroll tarda en aparecer la banda de la barra de estado. */
const FUNDIDO_BARRA = 14;
/** Alto de la barra compacta (como la de navegación de iOS). */
const ALTO_BARRA = 44;
/** Desde dónde el título grande ya se fue y aparece el compacto (y hasta dónde termina). */
const TITULO_DESDE = 40;
const TITULO_HASTA = 58;

/**
 * Contenedor con scroll: márgenes del diseño, safe area y ancho máximo en tablet.
 * Al bajar, una banda esmerilada tapa la barra de estado (como las apps de Apple):
 * sin ella el título grande pasaba por debajo de la hora y la batería. Con `titulo`,
 * cuando el título grande sale de la pantalla la banda crece y lo muestra compacto.
 */
export function Vista({
  children,
  refreshControl,
  gap = 16,
  titulo,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  gap?: number;
  /** El mismo título del Encabezado: aparece chico arriba al bajar. */
  titulo?: string;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const scrollY = useRef(new Animated.Value(0)).current;
  // En iOS el scroll arranca en -insets.top (el ajuste automático de la zona segura).
  const inicio = Platform.OS === "ios" ? -insets.top : 0;
  const opacidad = scrollY.interpolate({
    inputRange: [inicio, inicio + FUNDIDO_BARRA],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const compacto = scrollY.interpolate({
    inputRange: [inicio + TITULO_DESDE, inicio + TITULO_HASTA],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const subida = compacto.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });
  const fondoBarra = (
    <>
      <BlurView
        intensity={60}
        tint={t.oscuro ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
        style={StyleSheet.absoluteFill}
      />
      {/* Un velo del color de fondo para que se vea de la marca y no gris. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: t.fondo, opacity: 0.72 }]} />
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.fondo }}>
      <Animated.ScrollView
        style={{ flex: 1 }}
        // En iOS las tabs nativas ajustan solas los márgenes del primer scroll (zona segura
        // arriba, tab bar abajo): si además se suma insets.top, el título baja ~60 pt.
        // En Android no lo hacen, así que ahí van a mano.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={
          Platform.OS === "ios"
            ? { paddingTop: 8, paddingBottom: 32 }
            : { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }
        }
        // iOS: sube el contenido cuando aparece el teclado, para ver lo que se escribe.
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        <View style={[s.lectura, { gap }]}>{children}</View>
      </Animated.ScrollView>
      {insets.top > 0 ? (
        <View pointerEvents="none" style={s.barra}>
          {/* La franja de la hora: aparece apenas se baja. */}
          <Animated.View style={{ height: insets.top, opacity: opacidad, overflow: "hidden" }}>
            {fondoBarra}
            {titulo ? null : <View style={[s.barraLinea, { backgroundColor: t.separador }]} />}
          </Animated.View>
          {/* La barra compacta: aparece cuando el título grande ya se fue. */}
          {titulo ? (
            <Animated.View style={[s.barraTitulo, { height: ALTO_BARRA, opacity: compacto }]}>
              {fondoBarra}
              <Animated.Text
                style={[s.tituloCompacto, { color: t.texto, transform: [{ translateY: subida }] }]}
                numberOfLines={1}
              >
                {titulo}
              </Animated.Text>
              <View style={[s.barraLinea, { backgroundColor: t.separador }]} />
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Título grande con una línea chica arriba (estado o inventario) y una acción a
 * la derecha. Si se pasa `alTocar`, el título (o la línea de arriba, con
 * `tocarSobre`) abre el selector de inventario con un chevron ⌄.
 */
export function Encabezado({
  sobre,
  punto,
  titulo,
  accion,
  alTocar,
  tocarSobre = false,
  style,
}: {
  sobre?: string;
  punto?: string;
  titulo: string;
  accion?: ReactNode;
  alTocar?: () => void;
  /** El selector va en la línea de arriba (Accesos) en vez de en el título. */
  tocarSobre?: boolean;
  style?: EstiloAnimado;
}) {
  const t = useTema();
  const sobreTocable = !!alTocar && tocarSobre;
  const tituloTocable = !!alTocar && !tocarSobre;
  const lineaSobre = sobre ? (
    <View style={s.sobre}>
      {punto ? <View style={[s.punto, { backgroundColor: punto }]} /> : null}
      <Text
        style={[s.sobreTexto, { color: sobreTocable ? t.tinte : t.textoSec }]}
        numberOfLines={1}
      >
        {sobre}
      </Text>
      {sobreTocable ? (
        <Icono sf="chevron.down" ion="chevron-down" size={11} color={t.tinte} weight="bold" />
      ) : null}
    </View>
  ) : null;
  const lineaTitulo = (
    <View style={s.tituloFila}>
      <Text style={[s.titulo, { color: t.texto, flexShrink: 1 }]} numberOfLines={1}>
        {titulo}
      </Text>
      {tituloTocable ? (
        <Icono sf="chevron.down" ion="chevron-down" size={20} color={t.textoTer} weight="bold" />
      ) : null}
    </View>
  );
  // En iOS el selector es el menú nativo; en Android/web, un Alert.
  const menuIos = Platform.OS === "ios" && !!alTocar;
  const tocable = (hijo: ReactNode, hint: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      hitSlop={6}
      onPress={() => (tocar(), alTocar?.())}
      style={({ pressed }) => [
        { alignSelf: "flex-start", maxWidth: "100%" },
        pressed && { opacity: 0.6 },
      ]}
    >
      {hijo}
    </Pressable>
  );
  return (
    <Animated.View style={[s.encabezado, style]}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {sobreTocable && sobre && menuIos ? (
          <MenuInventario texto={sobre} variante="sobre" />
        ) : sobreTocable && lineaSobre ? (
          tocable(lineaSobre, "Cambiar de inventario")
        ) : (
          lineaSobre
        )}
        {tituloTocable && menuIos ? (
          <MenuInventario texto={titulo} variante="titulo" />
        ) : tituloTocable ? (
          tocable(lineaTitulo, "Cambiar de inventario, crear uno o eliminarlo")
        ) : (
          lineaTitulo
        )}
      </View>
      {accion}
    </Animated.View>
  );
}

/** Botón redondo blanco del encabezado (el "+" de Inventario). */
export function BotonRedondo({
  sf,
  ion,
  etiqueta,
  onPress,
}: {
  sf: Parameters<typeof Icono>[0]["sf"];
  ion: Parameters<typeof Icono>[0]["ion"];
  etiqueta: string;
  onPress: () => void;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Vidrio interactivo style={s.redondo}>
        <Icono sf={sf} ion={ion} size={24} color={t.tinte} weight="semibold" />
      </Vidrio>
    </Pressable>
  );
}

/**
 * Menú de un inventario (se abre manteniendo presionado): el owner lo puede
 * eliminar; el resto, salir de él.
 */
export function useMenuInventario() {
  const { usuario } = useSesion();
  const { eliminarInventario, salirDeInventario } = useAcciones();
  const avisarError = (titulo: string) => (e: Error) => Alert.alert(titulo, e.message);
  return (inv: Inventario) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const owner = inv.miembros.find((m) => m.usuario_id === usuario?.id)?.rol === "owner";
    if (owner) {
      const otros = inv.miembros.length - 1;
      confirmar(
        `¿Eliminar “${inv.nombre}”?`,
        `Se borran sus ${inv.total_productos} productos y sus fotos` +
          (otros > 0
            ? `, y ${otros === 1 ? "la otra persona deja" : `las otras ${otros} personas dejan`} de verlo`
            : "") +
          ". No se puede deshacer.",
        "Eliminar",
        () => void eliminarInventario(inv.id).catch(avisarError("No se pudo eliminar")),
      );
    } else {
      confirmar(
        `¿Salir de “${inv.nombre}”?`,
        "Vas a dejar de verlo. El owner te puede volver a invitar.",
        "Salir",
        () => void salirDeInventario(inv.id).catch(avisarError("No se pudo salir")),
      );
    }
  };
}

/**
 * Menú desplegable nativo (SwiftUI, como el título de Notas o Archivos) para
 * cambiar de inventario, crear uno o eliminar/salir del actual. Solo iOS: en
 * Android y web el encabezado usa el selector con Alert.
 */
function MenuInventario({
  texto,
  variante,
}: {
  texto: string;
  /** "titulo": el título grande (Inventario). "sobre": la línea chica de arriba (Accesos). */
  variante: "titulo" | "sobre";
}) {
  const t = useTema();
  const { usuario, seleccionarInventario } = useSesion();
  const { inventarios, activo } = useInventario();
  const menu = useMenuInventario();
  const owner =
    !!activo && activo.miembros.some((m) => m.rol === "owner" && m.usuario_id === usuario?.id);
  const grande = variante === "titulo";

  const etiqueta = (
    <HStack spacing={grande ? 6 : 4} alignment="center">
      <TextoSF
        modifiers={[
          font({ size: grande ? 34 : 13, weight: grande ? "bold" : "regular" }),
          kerning(grande ? -0.8 : 0),
          foregroundStyle(grande ? t.texto : t.tinte),
          lineLimit(1),
        ]}
      >
        {texto}
      </TextoSF>
      <ImagenSF
        systemName="chevron.down"
        size={grande ? 18 : 11}
        color={grande ? t.textoTer : t.tinte}
        modifiers={[font({ size: grande ? 18 : 11, weight: "bold" })]}
      />
    </HStack>
  );

  return (
    <Host matchContents style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
      <Menu label={etiqueta}>
        <Picker
          label="Inventarios"
          selection={activo?.id ?? null}
          onSelectionChange={(id: string | null) => id && seleccionarInventario(id)}
          modifiers={[pickerStyle("inline")]}
        >
          {inventarios.map((i) => (
            <TextoSF key={i.id} modifiers={[tag(i.id)]}>
              {i.nombre}
            </TextoSF>
          ))}
        </Picker>
        <Section>
          <Button
            label="Nuevo inventario"
            systemImage="plus"
            onPress={() => router.push("/inventario-nuevo")}
          />
          {activo && owner ? (
            <Button
              label="Editar inventario"
              systemImage="pencil"
              onPress={() =>
                router.push({ pathname: "/inventario-nuevo", params: { id: activo.id } })
              }
            />
          ) : null}
          {activo && owner ? (
            <Button
              label="Ver historial"
              systemImage="clock.arrow.circlepath"
              onPress={() => router.push("/historial")}
            />
          ) : null}
          {activo ? (
            <Button
              role="destructive"
              label={owner ? "Eliminar inventario" : "Salir del inventario"}
              systemImage={owner ? "trash" : "rectangle.portrait.and.arrow.right"}
              onPress={() => menu(activo)}
            />
          ) : null}
        </Section>
      </Menu>
    </Host>
  );
}

/**
 * Selector de inventario para Android y web (en iOS va MenuInventario): los
 * otros inventarios, "Nuevo inventario…" y eliminar/salir del actual.
 */
export function useSelectorInventario() {
  const { usuario, seleccionarInventario } = useSesion();
  const { inventarios, activo } = useInventario();
  const menu = useMenuInventario();
  return () => {
    const otros = inventarios.filter((i) => i.id !== activo?.id);
    const owner =
      !!activo && activo.miembros.some((m) => m.rol === "owner" && m.usuario_id === usuario?.id);
    const nuevo = () => router.push("/inventario-nuevo");
    const quitar = activo ? () => menu(activo) : undefined;
    const etiquetaQuitar = activo
      ? owner
        ? `Eliminar «${activo.nombre}»`
        : `Salir de «${activo.nombre}»`
      : undefined;

    // En web, Alert no muestra botones: menú flotante (web/dialogos.ts).
    if (Platform.OS === "web") {
      return menuWeb(activo ? activo.nombre : "Inventarios", [
        ...otros.map((i) => ({
          texto: i.nombre,
          icono: "shippingbox",
          onPress: () => seleccionarInventario(i.id),
        })),
        { texto: "Nuevo inventario…", icono: "plus", onPress: nuevo },
        ...(activo && owner
          ? [
              {
                texto: "Editar inventario…",
                icono: "pencil",
                onPress: () =>
                  router.push({ pathname: "/inventario-nuevo", params: { id: activo.id } }),
              },
              {
                texto: "Ver historial",
                icono: "clock.arrow.circlepath",
                onPress: () => router.push("/historial"),
              },
            ]
          : []),
        ...(etiquetaQuitar
          ? [
              {
                texto: etiquetaQuitar,
                icono: owner ? "trash" : "rectangle.portrait.and.arrow.right",
                onPress: quitar,
                destructiva: true,
              },
            ]
          : []),
      ]);
    }

    // Android / iOS
    Alert.alert(activo ? activo.nombre : "Inventarios", undefined, [
      ...otros
        .slice(0, 1)
        .map((i) => ({ text: i.nombre, onPress: () => seleccionarInventario(i.id) })),
      { text: "Nuevo inventario…", onPress: nuevo },
      ...(activo && owner
        ? [
            {
              text: "Editar inventario…",
              onPress: () =>
                router.push({ pathname: "/inventario-nuevo", params: { id: activo.id } }),
            },
            { text: "Ver historial", onPress: () => router.push("/historial") },
          ]
        : []),
      ...(etiquetaQuitar
        ? [{ text: etiquetaQuitar, style: "destructive" as const, onPress: quitar }]
        : []),
    ]);
  };
}

/** Selector segmentado con pulgar que se desliza (filtros, roles). */
export function SegmentadoAnimado<T extends string>({
  opciones,
  valor,
  onCambio,
  alto = 34,
  redondo = false,
  vidrio = false,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onCambio: (v: T) => void;
  alto?: number;
  /** Cápsula (el de invitar) en vez de esquinas de 10. */
  redondo?: boolean;
  /**
   * Liquid Glass, como los tabs de iOS 26: riel de vidrio claro interactivo y una
   * cápsula sólida del color de marca que se desliza al activo. Siempre redondo.
   */
  vidrio?: boolean;
}) {
  const t = useTema();
  const [ancho, setAncho] = useState(0);
  const indice = Math.max(
    0,
    opciones.findIndex((o) => o.valor === valor),
  );
  const pos = useRef(new Animated.Value(indice)).current;
  const anterior = useRef(indice);
  if (anterior.current !== indice) {
    anterior.current = indice;
    Animated.timing(pos, {
      toValue: indice,
      duration: 300,
      easing: BEZ_SEG,
      useNativeDriver: true,
    }).start();
  }
  const margen = vidrio ? 4 : 2;
  const anchoOpcion = (ancho - margen * 2) / opciones.length;
  const radio = redondo || vidrio ? alto / 2 : 10;
  const contenido = (
    <>
      {ancho > 0 ? (
        <Animated.View
          style={[
            s.segmentoPulgar,
            {
              top: margen,
              bottom: margen,
              left: margen,
              width: anchoOpcion,
              borderRadius: radio - margen,
              backgroundColor: vidrio ? t.tinte : t.oscuro ? "#636366" : "#fff",
              shadowColor: vidrio ? t.tinte : "#000",
              shadowOpacity: vidrio ? 0.3 : 0.1,
              transform: [{ translateX: Animated.multiply(pos, anchoOpcion) }],
            },
          ]}
        />
      ) : null}
      {opciones.map((o) => (
        <Pressable
          key={o.valor}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.valor === valor }}
          onPress={() => {
            if (o.valor === valor) return;
            tocar();
            onCambio(o.valor);
          }}
          style={s.segmentoOpcion}
        >
          <Text
            style={{
              color: vidrio && o.valor === valor ? t.sobreTinte : t.texto,
              fontSize: redondo || vidrio ? 15 : 13,
              fontWeight: redondo || vidrio || o.valor === valor ? "600" : "500",
              letterSpacing: -0.1,
            }}
            numberOfLines={1}
          >
            {o.etiqueta}
          </Text>
        </Pressable>
      ))}
    </>
  );
  const medir = (e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width);
  if (vidrio) {
    return (
      <View onLayout={medir}>
        <Vidrio
          claro
          interactivo
          style={[
            s.segmento,
            {
              height: alto,
              padding: margen,
              borderRadius: radio,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: t.separador,
            },
          ]}
        >
          {contenido}
        </Vidrio>
      </View>
    );
  }
  return (
    <View
      onLayout={medir}
      style={[s.segmento, { height: alto, borderRadius: radio, backgroundColor: t.relleno }]}
    >
      {contenido}
    </View>
  );
}

/** Título chico de una sección y su tarjeta blanca de esquinas 26. */
export function Seccion({
  titulo,
  derecha,
  pie,
  pieColor,
  children,
  style,
}: {
  titulo?: string;
  derecha?: ReactNode;
  pie?: string;
  pieColor?: string;
  children: ReactNode;
  style?: EstiloAnimado;
}) {
  const t = useTema();
  return (
    <Animated.View style={[{ gap: 6 }, style]}>
      {titulo || derecha ? (
        <View style={s.seccionCabecera}>
          {titulo ? (
            <Text style={[s.seccionTitulo, { color: t.texto }]} accessibilityRole="header">
              {titulo}
            </Text>
          ) : (
            <View />
          )}
          {derecha}
        </View>
      ) : null}
      {children}
      {pie ? <Text style={[s.pie, { color: pieColor ?? t.textoSec }]}>{pie}</Text> : null}
    </Animated.View>
  );
}

export function Tarjeta({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTema();
  return <View style={[s.tarjeta, { backgroundColor: t.celda }, style]}>{children}</View>;
}

/** Separador con sangría (alineado al texto, no al ícono). */
export function Separador({ sangria = 16 }: { sangria?: number }) {
  const t = useTema();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        marginLeft: sangria,
        backgroundColor: t.separador,
      }}
    />
  );
}

/** Miniatura de la foto del producto (URL firmada de Storage, cacheada por React Query). */
export function FotoProducto({
  ruta,
  tam = 40,
  radio = tam * 0.22,
}: {
  ruta: string;
  tam?: number;
  /** Por defecto, la curva de un ícono de app; en una tarjeta, el radio concéntrico. */
  radio?: number;
}) {
  const t = useTema();
  // La URL firmada no depende de actualizado_en (cambia con cada ajuste de stock): con
  // otra URL, iOS bajaría la foto de nuevo. Se reusa mientras dure, y las de todo el
  // inventario llegan juntas en un solo pedido (ver el store).
  const { data: url } = useQuery({
    queryKey: ["foto", ruta],
    queryFn: () => productosApi.urlFoto(ruta),
    staleTime: 12 * 60 * 60_000, // la URL firmada dura 24 h
    gcTime: 24 * 60 * 60_000,
  });
  return (
    <View
      style={{
        width: tam,
        height: tam,
        borderRadius: radio,
        overflow: "hidden",
        backgroundColor: t.relleno,
      }}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: tam, height: tam }} resizeMode="cover" />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  barra: { position: "absolute", top: 0, left: 0, right: 0 },
  barraTitulo: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 56,
  },
  tituloCompacto: { fontSize: 17, fontWeight: "600", fontFamily: fuenteMarca },
  barraLinea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  lectura: { width: "100%", maxWidth: ANCHO_LECTURA, alignSelf: "center", paddingHorizontal: 16 },
  encabezado: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  sobre: { flexDirection: "row", alignItems: "center", gap: 6 },
  punto: { width: 7, height: 7, borderRadius: 4 },
  sobreTexto: { fontSize: 13, flexShrink: 1 },
  tituloFila: { flexDirection: "row", alignItems: "center", gap: 6 },
  titulo: { fontSize: 34, fontWeight: "700", fontFamily: fuenteMarca, letterSpacing: -0.8 },
  redondo: {
    width: 44,
    height: 44,
    marginBottom: 2,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  segmento: { flexDirection: "row", padding: 2 },
  segmentoPulgar: {
    position: "absolute",
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentoOpcion: { flex: 1, alignItems: "center", justifyContent: "center" },
  seccionCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  // Igual que los títulos de Inventario ("Pendientes", "Productos").
  seccionTitulo: { fontSize: 20, fontWeight: "600", letterSpacing: -0.4, fontFamily: fuenteMarca },
  pie: { fontSize: 13, paddingHorizontal: 16 },
  tarjeta: { borderRadius: 26, overflow: "hidden" },
});
