import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { tocar } from "@/components/ui";
import { hslAHex, normalizarHex } from "@/lib/estiloCategoria";
import { tipo, useTema } from "@/lib/theme";

/**
 * Círculo cromático para elegir un color libre: tres anillos de tonos (vivos afuera,
 * oscuros en el medio, claros adentro), unos grises abajo y el código para escribirlo
 * a mano. En el centro, el color elegido.
 */

const LADO = 272;
const CENTRO = LADO / 2;

const ANILLOS = [
  { cantidad: 24, radio: 120, punto: 22, s: 90, l: 50 },
  { cantidad: 18, radio: 88, punto: 21, s: 80, l: 34 },
  { cantidad: 12, radio: 57, punto: 20, s: 80, l: 72 },
];

const GRISES = [10, 25, 40, 55, 70, 85].map((l) => hslAHex(0, 0, l));

const PUNTOS = ANILLOS.flatMap((a) =>
  Array.from({ length: a.cantidad }, (_, i) => {
    const tono = (360 / a.cantidad) * i;
    const ang = ((tono - 90) * Math.PI) / 180; // el rojo arriba
    return {
      color: hslAHex(tono, a.s, a.l),
      x: CENTRO + a.radio * Math.cos(ang) - a.punto / 2,
      y: CENTRO + a.radio * Math.sin(ang) - a.punto / 2,
      tam: a.punto,
    };
  }),
);

export function RuedaColor({
  valor,
  onCambio,
}: {
  valor: `#${string}` | null;
  onCambio: (color: `#${string}`) => void;
}) {
  const t = useTema();
  const [texto, setTexto] = useState(valor ?? "");
  // Si el color cambia desde la rueda, el campo lo muestra.
  useEffect(() => setTexto(valor ?? ""), [valor]);

  const elegir = (color: `#${string}`) => (tocar(), onCambio(color));
  const textoValido = normalizarHex(texto);

  const punto = (color: `#${string}`, tam: number, estilo?: object) => {
    const activo = valor?.toUpperCase() === color;
    return (
      <Pressable
        key={color + JSON.stringify(estilo ?? {})}
        accessibilityRole="button"
        accessibilityLabel={`Color ${color}`}
        accessibilityState={{ selected: activo }}
        hitSlop={2}
        onPress={() => elegir(color)}
        style={[
          {
            width: tam,
            height: tam,
            borderRadius: tam / 2,
            backgroundColor: color,
            borderWidth: activo ? 3 : 0,
            borderColor: t.celda,
          },
          activo && {
            shadowColor: "#000",
            shadowOpacity: 0.35,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
            transform: [{ scale: 1.25 }],
            zIndex: 2,
          },
          estilo,
        ]}
      />
    );
  };

  return (
    <View style={s.caja}>
      <View style={{ width: LADO, height: LADO }}>
        {PUNTOS.map((p) => punto(p.color, p.tam, { position: "absolute", left: p.x, top: p.y }))}
        <View
          accessibilityLabel={valor ? `Color elegido ${valor}` : "Sin color elegido"}
          style={[
            s.centro,
            {
              backgroundColor: valor ?? t.relleno,
              borderColor: t.separador,
            },
          ]}
        />
      </View>

      <View style={s.grises}>{GRISES.map((g) => punto(g, 26))}</View>

      <View style={[s.campo, { backgroundColor: t.relleno }]}>
        <Text style={[tipo.cuerpo, { color: t.textoSec }]}>Código</Text>
        <TextInput
          value={texto}
          onChangeText={(x) => {
            setTexto(x);
            const hex = normalizarHex(x);
            if (hex) onCambio(hex);
          }}
          placeholder="#C46A14"
          placeholderTextColor={t.textoTer}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          selectionColor={t.tinte}
          style={[
            tipo.cuerpo,
            s.input,
            { color: texto && !textoValido ? t.rojo : t.texto },
            Platform.OS === "web" && ({ outlineStyle: "none" } as object),
          ]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { alignItems: "center", gap: 16, paddingVertical: 16, paddingHorizontal: 14 },
  centro: {
    position: "absolute",
    left: CENTRO - 26,
    top: CENTRO - 26,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
  },
  grises: { flexDirection: "row", gap: 14 },
  campo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
    fontFamily: Platform.select({ ios: "ui-monospace", default: "monospace" }),
  },
});
