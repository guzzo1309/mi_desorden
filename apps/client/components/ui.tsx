import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { Children, Fragment, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
export type SFSymbol = ComponentProps<typeof SymbolView>["name"];
import { iniciales } from "@/lib/fecha";
import { tipo, useTema } from "@/lib/theme";

export const ANCHO_LECTURA = 680;
const GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

export const tocar = () => {
  if (Platform.OS !== "web") Haptics.selectionAsync().catch(() => {});
};

/* ---------- Íconos: SF Symbols en iOS, Ionicons en el resto ---------- */

export function Icono({
  sf,
  ion,
  size = 20,
  color,
  weight = "medium",
}: {
  sf: SFSymbol;
  ion: ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color: string;
  weight?: ComponentProps<typeof SymbolView>["weight"];
}) {
  const fallback = <Ionicons name={ion} size={size} color={color} />;
  if (Platform.OS !== "ios") return fallback;
  return (
    <SymbolView
      name={sf}
      size={size}
      tintColor={color}
      weight={weight}
      fallback={fallback}
      style={{ width: size, height: size }}
    />
  );
}

/* ---------- Liquid Glass (iOS 26+) con blur como respaldo ---------- */

export function Vidrio({
  children,
  style,
  interactivo,
  tinte,
  claro,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  interactivo?: boolean;
  tinte?: string;
  /** Vidrio "clear": más transparente, para encima de la cámara. */
  claro?: boolean;
}) {
  const t = useTema();
  if (GLASS) {
    return (
      <GlassView
        glassEffectStyle={claro ? "clear" : "regular"}
        isInteractive={interactivo}
        tintColor={tinte}
        style={style}
      >
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView
      intensity={Platform.OS === "web" ? 40 : 80}
      tint={t.oscuro ? "systemChromeMaterialDark" : "systemChromeMaterialLight"}
      style={[
        style,
        { overflow: "hidden" },
        tinte
          ? { backgroundColor: tinte }
          : Platform.OS !== "ios" && {
              backgroundColor: t.oscuro ? "rgba(40,40,44,0.72)" : "rgba(255,255,255,0.72)",
            },
      ]}
    >
      {children}
    </BlurView>
  );
}

/** Botón redondo de vidrio, como los de la barra de iOS 26. */
export function BotonVidrio({
  sf,
  ion,
  onPress,
  etiqueta,
  tam = 44,
  color,
  claro,
}: {
  sf: SFSymbol;
  ion: ComponentProps<typeof Ionicons>["name"];
  onPress?: () => void;
  etiqueta: string;
  tam?: number;
  color?: string;
  claro?: boolean;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={() => {
        tocar();
        onPress?.();
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <Vidrio
        interactivo
        claro={claro}
        style={{
          width: tam,
          height: tam,
          borderRadius: tam / 2,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icono sf={sf} ion={ion} size={tam * 0.42} color={color ?? t.texto} weight="semibold" />
      </Vidrio>
    </Pressable>
  );
}

/**
 * Botón de texto de la barra de un modal ("Cancelar", "Cerrar"). Con padding propio:
 * en iOS 26 la barra lo mete en una cápsula de vidrio del tamaño del contenido, y
 * sin aire queda un óvalo apretado en vez de una píldora.
 */
export function BotonCabecera({
  texto,
  onPress,
  fuerte,
  apagado,
}: {
  texto: string;
  onPress: () => void;
  fuerte?: boolean;
  apagado?: boolean;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={apagado}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={[
          tipo.cuerpo,
          { color: apagado ? t.textoTer : t.tinte, fontWeight: fuerte ? "600" : "400" },
        ]}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/* ---------- Contenedor de pantalla bajo header nativo ---------- */

export function Contenido({
  children,
  style,
  ...props
}: ScrollViewProps & { children: ReactNode }) {
  const t = useTema();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      // iOS: sube el contenido cuando aparece el teclado, para ver lo que se escribe.
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={[{ flex: 1, backgroundColor: t.fondo }, style]}
      contentContainerStyle={s.contenido}
      {...props}
    >
      <View style={s.lectura}>{children}</View>
    </ScrollView>
  );
}

/* ---------- Listas agrupadas (inset grouped) ---------- */

export function Grupo({
  titulo,
  pie,
  children,
  sangria = 16,
  pieError,
}: {
  titulo?: string;
  pie?: string;
  pieError?: boolean;
  children: ReactNode;
  /** Desde dónde arranca el separador (más si la fila tiene ícono). */
  sangria?: number;
}) {
  const t = useTema();
  const filas = Children.toArray(children).filter(Boolean);
  return (
    <View style={s.grupo}>
      {titulo ? <Text style={[s.grupoTitulo, { color: t.textoSec }]}>{titulo}</Text> : null}
      <View style={[s.grupoCaja, { backgroundColor: t.celda }]}>
        {filas.map((fila, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View style={[s.separador, { backgroundColor: t.separador, marginLeft: sangria }]} />
            ) : null}
            {fila}
          </Fragment>
        ))}
      </View>
      {pie ? (
        <Text style={[s.grupoPie, { color: pieError ? t.rojo : t.textoSec }]}>{pie}</Text>
      ) : null}
    </View>
  );
}

export function Fila({
  titulo,
  subtitulo,
  izquierda,
  derecha,
  valor,
  onPress,
  chevron,
  destructiva,
  tinte,
  apagada,
}: {
  titulo: string;
  subtitulo?: string;
  izquierda?: ReactNode;
  derecha?: ReactNode;
  valor?: string;
  onPress?: () => void;
  chevron?: boolean;
  destructiva?: boolean;
  tinte?: boolean;
  apagada?: boolean;
}) {
  const t = useTema();
  const colorTitulo = apagada ? t.textoTer : destructiva ? t.rojo : tinte ? t.tinte : t.texto;
  return (
    <Pressable
      onPress={onPress ? () => (tocar(), onPress()) : undefined}
      disabled={!onPress}
      style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
    >
      {izquierda}
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={[tipo.cuerpo, { color: colorTitulo }]} numberOfLines={1}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[tipo.subtitulo, { color: t.textoSec }]} numberOfLines={1}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {valor ? (
        <Text style={[tipo.cuerpo, { color: t.textoSec, flexShrink: 1 }]} numberOfLines={1}>
          {valor}
        </Text>
      ) : null}
      {derecha}
      {chevron ? (
        <Icono
          sf="chevron.right"
          ion="chevron-forward"
          size={14}
          color={t.textoTer}
          weight="semibold"
        />
      ) : null}
    </Pressable>
  );
}

/** Ícono cuadrado de color, como en Ajustes. */
export function IconoCelda({
  sf,
  ion,
  fondo,
}: {
  sf: SFSymbol;
  ion: ComponentProps<typeof Ionicons>["name"];
  fondo: string;
}) {
  return (
    <View style={[s.iconoCelda, { backgroundColor: fondo }]}>
      <Icono sf={sf} ion={ion} size={17} color="#fff" weight="semibold" />
    </View>
  );
}

export function CampoFila({ etiqueta, ...props }: TextInputProps & { etiqueta?: string }) {
  const t = useTema();
  return (
    <View style={s.fila}>
      {etiqueta ? (
        <Text style={[tipo.cuerpo, { color: t.texto, width: 110 }]}>{etiqueta}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={t.textoTer}
        selectionColor={t.tinte}
        style={[
          tipo.cuerpo,
          { flex: 1, minWidth: 0, color: t.texto, paddingVertical: 0 },
          Platform.OS === "web" && ({ outlineStyle: "none" } as object),
        ]}
        {...props}
      />
    </View>
  );
}

/* ---------- Botones y controles ---------- */

export function BotonPrincipal({
  children,
  onPress,
  deshabilitado,
  cargando,
  variante = "lleno",
}: {
  children: string;
  onPress?: () => void;
  deshabilitado?: boolean;
  cargando?: boolean;
  variante?: "lleno" | "gris" | "destructivo";
}) {
  const t = useTema();
  const fondo = variante === "lleno" ? t.tinte : t.relleno;
  const texto = variante === "lleno" ? "#fff" : variante === "destructivo" ? t.rojo : t.tinte;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado || cargando}
      onPress={() => {
        tocar();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.principal,
        { backgroundColor: fondo, opacity: deshabilitado ? 0.4 : pressed ? 0.8 : 1 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={texto} />
      ) : (
        <Text style={[tipo.destacado, { color: texto }]}>{children}</Text>
      )}
    </Pressable>
  );
}

export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
}: {
  opciones: { valor: T; etiqueta: string }[];
  valor: T;
  onCambio: (v: T) => void;
}) {
  const t = useTema();
  return (
    <View style={[s.segmentado, { backgroundColor: t.relleno }]}>
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <Pressable
            key={o.valor}
            onPress={() => {
              tocar();
              onCambio(o.valor);
            }}
            style={[
              s.segmento,
              activo && [s.segmentoActivo, { backgroundColor: t.oscuro ? "#636366" : "#fff" }],
            ]}
          >
            <Text
              style={[tipo.nota, { color: t.texto, fontWeight: activo ? "600" : "500" }]}
              numberOfLines={1}
            >
              {o.etiqueta}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pildora({
  children,
  activa,
  onPress,
  punto,
}: {
  children: string;
  activa?: boolean;
  onPress?: () => void;
  punto?: string;
}) {
  const t = useTema();
  return (
    <Pressable
      onPress={() => {
        tocar();
        onPress?.();
      }}
      style={({ pressed }) => [
        s.pildora,
        { backgroundColor: activa ? t.texto : t.celda, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {punto ? <View style={[s.punto, { backgroundColor: punto }]} /> : null}
      <Text
        style={[tipo.subtitulo, { color: activa ? t.fondo : t.texto, fontWeight: "600" }]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </Pressable>
  );
}

/* ---------- Varios ---------- */

const PALETA_AVATAR = [
  ["#FF9F0A", "#FF6B00"],
  ["#64D2FF", "#0A84FF"],
  ["#BF5AF2", "#5E5CE6"],
  ["#30D158", "#00A86B"],
  ["#FF6482", "#FF375F"],
];

export function Avatar({
  nombre,
  tam = 40,
  enLinea,
}: {
  nombre: string;
  tam?: number;
  enLinea?: boolean;
}) {
  const t = useTema();
  const [a] =
    PALETA_AVATAR[[...nombre].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETA_AVATAR.length]!;
  return (
    <View>
      <View
        style={{
          width: tam,
          height: tam,
          borderRadius: tam / 2,
          backgroundColor: a,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "600", fontSize: tam * 0.4 }}>
          {iniciales(nombre)}
        </Text>
      </View>
      {enLinea ? (
        <View style={[s.presencia, { backgroundColor: t.verde, borderColor: t.celda }]} />
      ) : null}
    </View>
  );
}

export function Vacio({
  sf,
  ion,
  titulo,
  texto,
}: {
  sf: SFSymbol;
  ion: ComponentProps<typeof Ionicons>["name"];
  titulo: string;
  texto?: string;
}) {
  const t = useTema();
  return (
    <View style={s.vacio}>
      <Icono sf={sf} ion={ion} size={44} color={t.textoTer} weight="regular" />
      <Text style={[tipo.titulo3, { color: t.texto, textAlign: "center" }]}>{titulo}</Text>
      {texto ? (
        <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center", maxWidth: 300 }]}>
          {texto}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  contenido: { paddingBottom: 48 },
  lectura: {
    width: "100%",
    maxWidth: ANCHO_LECTURA,
    alignSelf: "center",
    paddingHorizontal: 16,
    gap: 24,
    paddingTop: 8,
  },
  grupo: { gap: 6 },
  grupoTitulo: { ...tipo.nota, textTransform: "uppercase", paddingHorizontal: 16 },
  grupoPie: { ...tipo.nota, paddingHorizontal: 16 },
  grupoCaja: { borderRadius: 26, overflow: "hidden" },
  separador: { height: StyleSheet.hairlineWidth },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  iconoCelda: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  principal: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  segmentado: { flexDirection: "row", borderRadius: 9, padding: 2 },
  segmento: {
    flex: 1,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    paddingHorizontal: 8,
  },
  segmentoActivo: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pildora: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  presencia: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  vacio: { alignItems: "center", gap: 10, paddingVertical: 64, paddingHorizontal: 24 },
});
