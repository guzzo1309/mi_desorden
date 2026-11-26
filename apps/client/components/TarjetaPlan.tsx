import type { Periodo, Plan } from "@mi-desorden/core";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { ahorroAnual, dinero, partesPrecio, precioDe, textoLimite } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

type IconoSF = Parameters<typeof Icono>[0]["sf"];
type IconoIon = Parameters<typeof Icono>[0]["ion"];

/**
 * Un plan como tarjeta de metal: el frente con la marca, el chip, el precio y el
 * nombre grabado; debajo, lo que incluye. Cada nivel tiene su metal (grafito,
 * champaña, obsidiana con dorado). La elegida lleva un aro del color de la marca.
 */

export interface Metal {
  /** Degradado del frente. */
  fondo: string;
  /** Letras grabadas. */
  texto: string;
  /** Detalles: marca, aro de selección, ícono sin contacto. */
  acento: string;
}

const METALES: Metal[] = [
  // Grafito
  {
    fondo: "linear-gradient(135deg, #6a7079 0%, #3a3e44 45%, #1c1e21 100%)",
    texto: "#EEF0F3",
    acento: "#C9CED6",
  },
  // Champaña
  {
    fondo: "linear-gradient(135deg, #c9a66b 0%, #8a6934 48%, #3f2d12 100%)",
    texto: "#FFF7E8",
    acento: "#F6DFAE",
  },
  // Obsidiana con dorado
  {
    fondo: "linear-gradient(135deg, #34343a 0%, #141416 50%, #050506 100%)",
    texto: "#F3E2BC",
    acento: "#D6B26E",
  },
];

/** Metal de un plan según su posición (del más simple al más alto). */
export function metalDe(nivel: number): Metal {
  return METALES[Math.max(0, Math.min(nivel, METALES.length - 1))]!;
}

/** La tarjeta en miniatura (solo el metal y el chip): para filas y etiquetas. */
export function MiniTarjeta({ nivel = 0, ancho = 44 }: { nivel?: number; ancho?: number }) {
  const metal = metalDe(nivel);
  const radio = ancho * 0.12;
  return (
    <View
      style={{
        width: ancho,
        aspectRatio: 1.586,
        borderRadius: radio,
        overflow: "hidden",
        backgroundImage: metal.fondo,
        boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
        justifyContent: "center",
        paddingLeft: ancho * 0.12,
      }}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: BRILLO }]} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.canto, { borderRadius: radio }]}
      />
      <View
        style={{
          width: ancho * 0.22,
          height: ancho * 0.16,
          borderRadius: ancho * 0.03,
          backgroundImage: CHIP,
        }}
      />
    </View>
  );
}

/** Reflejo diagonal sobre el metal. */
const BRILLO =
  "linear-gradient(115deg, rgba(255,255,255,0) 25%, rgba(255,255,255,0.16) 42%, rgba(255,255,255,0) 58%)";
const CHIP = "linear-gradient(135deg, #f7e3ae 0%, #d1a85a 50%, #9c7431 100%)";

const LETRA = Platform.select({ ios: "Avenir Next", default: undefined });

export function TarjetaPlan({
  plan,
  nivel = 0,
  periodo: pago = "mensual",
  elegida,
  actual,
  pedida,
  onPress,
}: {
  plan: Plan;
  /** Posición en la lista de planes: elige el metal (del más simple al más alto). */
  nivel?: number;
  /** Qué precio se muestra: por mes o por año. */
  periodo?: Periodo;
  elegida?: boolean;
  actual?: boolean;
  /** Ya hay un pedido pendiente por este plan. */
  pedida?: boolean;
  onPress?: () => void;
}) {
  const t = useTema();
  const metal = METALES[Math.min(nivel, METALES.length - 1)]!;
  const precio = precioDe(plan, pago);
  const { monto, periodo } = partesPrecio(precio, pago);
  // En el anual: cuánto sale por mes y cuánto se ahorra.
  const ahorro = pago === "anual" ? ahorroAnual(plan) : null;
  const porMes = pago === "anual" && precio ? `${dinero(precio / 12)} / mes` : null;
  const etiqueta = actual ? "TU PLAN" : pedida ? "PEDIDO" : null;
  const grabado = { color: metal.texto, ...s.grabado };

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: !!elegida, disabled: !onPress }}
      accessibilityLabel={`Plan ${plan.nombre}, ${monto}${periodo ? ` ${periodo}` : ""}${actual ? ", tu plan actual" : ""}`}
      disabled={!onPress}
      onPress={onPress ? () => (tocar(), onPress()) : undefined}
      style={({ pressed }) => [
        s.envoltura,
        {
          borderColor: elegida ? t.tinte : "transparent",
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {/* Frente de la tarjeta */}
      <View style={[s.cara, { backgroundImage: metal.fondo }]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: BRILLO }]} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.canto]} />

        <View style={s.fila}>
          <Text style={[s.marca, { color: metal.acento }]}>MI DESORDEN</Text>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <View style={s.precio}>
              <Text style={[s.monto, grabado]}>{monto}</Text>
              {periodo ? <Text style={[s.periodo, { color: metal.texto }]}>{periodo}</Text> : null}
            </View>
            {porMes ? (
              <Text style={[s.periodo, { color: metal.texto }]}>
                {porMes}
                {ahorro ? (
                  <Text style={{ color: metal.acento, fontWeight: "700" }}>{`  −${ahorro} %`}</Text>
                ) : null}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[s.fila, { alignItems: "center" }]}>
          <Chip />
          <Icono sf="wave.3.right" ion="wifi" size={22} color={metal.acento} />
        </View>

        <View style={[s.fila, { alignItems: "flex-end" }]}>
          <Text style={[s.nombre, grabado]} numberOfLines={1}>
            {plan.nombre.toUpperCase()}
          </Text>
          {etiqueta ? (
            <View style={[s.etiqueta, { borderColor: metal.acento }]}>
              <Text style={[s.etiquetaTexto, { color: metal.acento }]}>{etiqueta}</Text>
            </View>
          ) : onPress ? (
            <Icono
              sf={elegida ? "checkmark.circle.fill" : "circle"}
              ion={elegida ? "checkmark-circle" : "ellipse-outline"}
              size={26}
              color={elegida ? metal.acento : `${metal.texto}99`}
            />
          ) : null}
        </View>
      </View>

      {/* Lo que incluye */}
      <View style={s.detalle}>
        {plan.descripcion ? (
          <Text style={[tipo.subtitulo, { color: t.textoSec }]}>{plan.descripcion}</Text>
        ) : null}
        <View style={s.incluyeGrilla}>
          <Incluye
            sf="shippingbox"
            ion="cube-outline"
            n={plan.max_inventarios}
            uno="inventario"
            varios="inventarios"
          />
          {plan.max_categorias !== undefined ? (
            <Incluye
              sf="folder"
              ion="folder-outline"
              n={plan.max_categorias}
              uno="categoría"
              varios="categorías"
            />
          ) : null}
          <Incluye
            sf="square.stack.3d.up"
            ion="layers-outline"
            n={plan.max_productos}
            uno="producto"
            varios="productos"
          />
          <Incluye
            sf="person.2"
            ion="people-outline"
            n={plan.max_personas}
            uno="persona"
            varios="personas"
          />
        </View>
      </View>
    </Pressable>
  );
}

/** El chip dorado, con sus contactos. */
function Chip() {
  return (
    <View style={[s.chip, { backgroundImage: CHIP }]}>
      <View style={[s.chipLinea, { top: "33%" }]} />
      <View style={[s.chipLinea, { top: "66%" }]} />
      <View style={s.chipCentro} />
    </View>
  );
}

/** Una línea de lo que incluye: ícono, número en negrita y qué es. */
function Incluye({
  sf,
  ion,
  n,
  uno,
  varios,
}: {
  sf: IconoSF;
  ion: IconoIon;
  n: number | null;
  uno: string;
  varios: string;
}) {
  const t = useTema();
  return (
    <View style={s.incluye}>
      <Icono sf={sf} ion={ion} size={16} color={t.tinte} />
      {n === null ? (
        <Text style={[tipo.subtitulo, { color: t.texto, flex: 1 }]} numberOfLines={1}>
          {varios.charAt(0).toUpperCase() + varios.slice(1)}{" "}
          <Text style={{ fontWeight: "600" }}>sin límite</Text>
        </Text>
      ) : (
        <Text style={[tipo.subtitulo, { color: t.texto, flex: 1 }]} numberOfLines={1}>
          <Text style={{ fontWeight: "600" }}>{textoLimite(n)}</Text> {n === 1 ? uno : varios}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  envoltura: { borderRadius: 26, borderWidth: 2, padding: 4, gap: 12 },
  cara: {
    aspectRatio: 1.586,
    borderRadius: 20,
    padding: 20,
    justifyContent: "space-between",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
  },
  // Canto del metal: un filo claro arriba y oscuro abajo.
  canto: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.35)",
    borderLeftColor: "rgba(255,255,255,0.2)",
    borderRightColor: "rgba(0,0,0,0.3)",
    borderBottomColor: "rgba(0,0,0,0.45)",
  },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  marca: { fontFamily: LETRA, fontSize: 12, fontWeight: "600", letterSpacing: 3 },
  grabado: {
    fontFamily: LETRA,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  precio: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  monto: { fontSize: 30, fontWeight: "700", letterSpacing: -0.3 },
  periodo: { fontFamily: LETRA, fontSize: 13, opacity: 0.8 },
  nombre: { flex: 1, fontSize: 22, fontWeight: "600", letterSpacing: 4 },
  etiqueta: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  etiquetaTexto: { fontFamily: LETRA, fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  chip: { width: 46, height: 34, borderRadius: 7, overflow: "hidden" },
  chipLinea: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: "rgba(80,55,15,0.45)",
  },
  chipCentro: {
    position: "absolute",
    left: "34%",
    right: "34%",
    top: 0,
    bottom: 0,
    borderLeftWidth: StyleSheet.hairlineWidth * 2,
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(80,55,15,0.45)",
  },
  detalle: { gap: 10, paddingHorizontal: 10, paddingBottom: 10 },
  incluyeGrilla: { flexDirection: "row", flexWrap: "wrap", rowGap: 8 },
  incluye: { flexDirection: "row", alignItems: "center", gap: 8, width: "50%", paddingRight: 8 },
});
