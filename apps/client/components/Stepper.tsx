import { Pressable, StyleSheet, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { useTema } from "@/lib/theme";

/** El UIStepper de iOS: − | + en una cápsula gris. */
export function Stepper({
  valor,
  onCambio,
  min = 0,
}: {
  valor: number;
  onCambio: (n: number) => void;
  min?: number;
}) {
  const t = useTema();
  const boton = (delta: number) => (
    <Pressable
      accessibilityLabel={delta > 0 ? "Sumar" : "Restar"}
      disabled={valor + delta < min}
      onPress={() => (tocar(), onCambio(valor + delta))}
      style={({ pressed }) => [s.boton, { cursor: 'pointer' }, { opacity: valor + delta < min ? 0.3 : pressed ? 0.5 : 1 }]}
    >
      <Icono
        sf={delta > 0 ? "plus" : "minus"}
        ion={delta > 0 ? "add" : "remove"}
        size={16}
        color={t.texto}
        weight="semibold"
      />
    </Pressable>
  );
  return (
    <View style={[s.capsula, { backgroundColor: t.relleno }]}>
      {boton(-1)}
      <View style={[s.divisor, { backgroundColor: t.separador }]} />
      {boton(1)}
    </View>
  );
}

const s = StyleSheet.create({
  capsula: { flexDirection: "row", alignItems: "center", borderRadius: 9, height: 32 },
  boton: { width: 46, height: 32, alignItems: "center", justifyContent: "center", cursor: "pointer" },
  divisor: { width: StyleSheet.hairlineWidth, height: 18 },
});
