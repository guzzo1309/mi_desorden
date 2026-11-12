import type { Plan } from "@mi-desorden/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { partesPrecio, textoLimite } from "@/lib/planes";
import { fuenteMarca, tipo, useTema } from "@/lib/theme";

type IconoSF = Parameters<typeof Icono>[0]["sf"];
type IconoIon = Parameters<typeof Icono>[0]["ion"];

/**
 * Un plan como tarjeta (al estilo de los planes de iCloud+): nombre, precio grande
 * y lo que incluye. La elegida lleva borde del color de la marca y un tilde; la del
 * plan actual se ve apagada y no se puede elegir.
 */
export function TarjetaPlan({
  plan,
  elegida,
  actual,
  pedida,
  onPress,
}: {
  plan: Plan;
  elegida?: boolean;
  actual?: boolean;
  /** Ya hay un pedido pendiente por este plan. */
  pedida?: boolean;
  onPress?: () => void;
}) {
  const t = useTema();
  const { monto, periodo } = partesPrecio(plan.precio_mensual);
  const etiqueta = actual ? "Tu plan" : pedida ? "Pedido" : null;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: !!elegida, disabled: !onPress }}
      accessibilityLabel={`Plan ${plan.nombre}, ${monto}${periodo ? ` ${periodo}` : ""}`}
      disabled={!onPress}
      onPress={onPress ? () => (tocar(), onPress()) : undefined}
      style={({ pressed }) => [
        s.tarjeta,
        {
          backgroundColor: t.celda,
          borderColor: elegida ? t.tinte : "transparent",
          opacity: actual ? 0.6 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      <View style={s.cabeza}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={s.nombreFila}>
            <Text style={[tipo.titulo3, { color: t.texto }]} numberOfLines={1}>
              {plan.nombre}
            </Text>
            {etiqueta ? (
              <View style={[s.etiqueta, { backgroundColor: `${t.tinte}1F` }]}>
                <Text style={[tipo.leyenda, { color: t.tinte, fontWeight: "600" }]}>
                  {etiqueta}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={s.precio}>
            <Text style={[s.monto, { color: t.texto }]}>{monto}</Text>
            {periodo ? (
              <Text style={[tipo.subtitulo, { color: t.textoSec }]}>{periodo}</Text>
            ) : null}
          </View>
        </View>
        {onPress ? (
          <Icono
            sf={elegida ? "checkmark.circle.fill" : "circle"}
            ion={elegida ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={elegida ? t.tinte : t.textoTer}
          />
        ) : null}
      </View>

      {plan.descripcion ? (
        <Text style={[tipo.subtitulo, { color: t.textoSec }]}>{plan.descripcion}</Text>
      ) : null}

      <View style={[s.separador, { backgroundColor: t.separador }]} />

      <View style={{ gap: 10 }}>
        <Incluye
          sf="shippingbox"
          ion="cube-outline"
          n={plan.max_inventarios}
          uno="inventario"
          varios="inventarios"
        />
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
    </Pressable>
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
      <Icono sf={sf} ion={ion} size={18} color={t.tinte} />
      {n === null ? (
        <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>
          {varios.charAt(0).toUpperCase() + varios.slice(1)}{" "}
          <Text style={{ fontWeight: "600" }}>sin límite</Text>
        </Text>
      ) : (
        <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>
          <Text style={{ fontWeight: "600" }}>{textoLimite(n)}</Text> {n === 1 ? uno : varios}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  tarjeta: { borderRadius: 26, borderWidth: 2, padding: 18, gap: 12 },
  cabeza: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  etiqueta: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  precio: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  monto: { fontSize: 34, fontWeight: "700", letterSpacing: -0.6, fontFamily: fuenteMarca },
  separador: { height: StyleSheet.hairlineWidth },
  incluye: { flexDirection: "row", alignItems: "center", gap: 12 },
});
