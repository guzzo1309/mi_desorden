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
  ScrollView,
  StyleSheet,
  Text,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { productos as productosApi } from "@/api";
import { ANCHO_LECTURA, Icono, tocar } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { useStore } from "@/lib/store";
import { useTema } from "@/lib/theme";

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

/** Contenedor con scroll: márgenes del diseño, safe area y ancho máximo en tablet. */
export function Vista({
  children,
  refreshControl,
  gap = 16,
}: {
  children: ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  gap?: number;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.fondo }}
      // En iOS las tabs nativas ajustan solas los márgenes del primer scroll (zona segura
      // arriba, tab bar abajo): si además se suma insets.top, el título baja ~60 pt.
      // En Android no lo hacen, así que ahí van a mano.
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={
        Platform.OS === "ios"
          ? { paddingTop: 8, paddingBottom: 32 }
          : { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }
      }
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      <View style={[s.lectura, { gap }]}>{children}</View>
    </ScrollView>
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
      style={({ pressed }) => [
        s.redondo,
        { backgroundColor: t.celda, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}
    >
      <Icono sf={sf} ion={ion} size={24} color={t.tinte} weight="semibold" />
    </Pressable>
  );
}

/**
 * Menú de un inventario (se abre manteniendo presionado): el dueño lo puede
 * eliminar; el resto, salir de él.
 */
export function useMenuInventario() {
  const { usuario, eliminarInventario, salirDeInventario } = useStore();
  const avisarError = (titulo: string) => (e: Error) => Alert.alert(titulo, e.message);
  return (inv: Inventario) => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const dueño = inv.miembros.find((m) => m.usuario_id === usuario?.id)?.rol === "dueño";
    if (dueño) {
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
        "Vas a dejar de verlo. El dueño te puede volver a invitar.",
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
  const { inventarios, activo, usuario, seleccionarInventario } = useStore();
  const menu = useMenuInventario();
  const dueño =
    !!activo && activo.miembros.some((m) => m.rol === "dueño" && m.usuario_id === usuario?.id);
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
          {activo ? (
            <Button
              role="destructive"
              label={dueño ? "Eliminar inventario" : "Salir del inventario"}
              systemImage={dueño ? "trash" : "rectangle.portrait.and.arrow.right"}
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
  const { inventarios, activo, usuario, seleccionarInventario } = useStore();
  const menu = useMenuInventario();
  return () => {
    const otros = inventarios.filter((i) => i.id !== activo?.id);
    const dueño =
      !!activo && activo.miembros.some((m) => m.rol === "dueño" && m.usuario_id === usuario?.id);
    const nuevo = () => router.push("/inventario-nuevo");
    const quitar = activo ? () => menu(activo) : undefined;
    const etiquetaQuitar = activo
      ? dueño
        ? `Eliminar «${activo.nombre}»`
        : `Salir de «${activo.nombre}»`
      : undefined;

    // Android / web: Alert admite pocos botones; alcanza para el MVP.
    Alert.alert(activo ? activo.nombre : "Inventarios", undefined, [
      ...otros
        .slice(0, 1)
        .map((i) => ({ text: i.nombre, onPress: () => seleccionarInventario(i.id) })),
      { text: "Nuevo inventario…", onPress: nuevo },
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
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onCambio: (v: T) => void;
  alto?: number;
  /** Cápsula (el de invitar) en vez de esquinas de 10. */
  redondo?: boolean;
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
  const anchoOpcion = (ancho - 4) / opciones.length;
  const radio = redondo ? alto / 2 : 10;
  return (
    <View
      onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
      style={[s.segmento, { height: alto, borderRadius: radio, backgroundColor: t.relleno }]}
    >
      {ancho > 0 ? (
        <Animated.View
          style={[
            s.segmentoPulgar,
            {
              width: anchoOpcion,
              borderRadius: radio - 2,
              backgroundColor: t.oscuro ? "#636366" : "#fff",
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
              color: t.texto,
              fontSize: redondo ? 15 : 13,
              fontWeight: redondo || o.valor === valor ? "600" : "500",
              letterSpacing: -0.1,
            }}
            numberOfLines={1}
          >
            {o.etiqueta}
          </Text>
        </Pressable>
      ))}
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
            <Text style={[s.seccionTitulo, { color: t.textoSec }]}>{titulo}</Text>
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
  version,
}: {
  ruta: string;
  tam?: number;
  version?: string;
}) {
  const t = useTema();
  const { data: url } = useQuery({
    queryKey: ["foto", ruta, version],
    queryFn: () => productosApi.urlFoto(ruta),
    staleTime: 50 * 60_000, // la URL firmada dura una hora
  });
  return (
    <View
      style={{
        width: tam,
        height: tam,
        borderRadius: tam * 0.22,
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
  titulo: { fontSize: 34, fontWeight: "700", letterSpacing: -0.8 },
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
    top: 2,
    bottom: 2,
    left: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentoOpcion: { flex: 1, alignItems: "center", justifyContent: "center" },
  seccionCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  seccionTitulo: { fontSize: 13, fontWeight: "600" },
  pie: { fontSize: 13, paddingHorizontal: 16 },
  tarjeta: { borderRadius: 26, overflow: "hidden" },
});
