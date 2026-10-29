import { Pressable, StyleSheet, Text, View } from "react-native";
import { Tarjeta } from "@/components/vistas";
import { nivelCupo } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

export interface Uso {
  /** En plural: "Productos", "Personas". */
  etiqueta: string;
  usados: number;
  /** null = ilimitado. */
  max: number | null;
}

/**
 * El plan del inventario y cuánto lleva usado de cada límite, siempre a la vista:
 * "Plan Free · Productos 0 / 100 · Personas 1 / 2". Verde mientras sobra, naranja
 * desde el 80 % y rojo al llegar. Con `onCambiar` ofrece pedir otro plan.
 */
export function PlanUso({
  plan,
  usos,
  onCambiar,
}: {
  plan: string;
  usos: Uso[];
  onCambiar?: () => void;
}) {
  const t = useTema();
  const resumen = usos
    .map((u) => `${u.etiqueta} ${u.usados}${u.max === null ? ", sin límite" : ` de ${u.max}`}`)
    .join(". ");
  return (
    <Tarjeta style={s.caja}>
      <View style={s.cabecera} accessible accessibilityLabel={`Plan ${plan}. ${resumen}`}>
        <Text style={[tipo.destacado, { color: t.texto }]}>Plan {plan}</Text>
        {onCambiar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar de plan"
            hitSlop={8}
            onPress={onCambiar}
          >
            <Text style={[tipo.subtitulo, { color: t.tinte, fontWeight: "600" }]}>Cambiar</Text>
          </Pressable>
        ) : null}
      </View>
      <View style={s.fila}>
        {usos.map((u) => {
          const nivel = nivelCupo(u.usados, u.max);
          const color = nivel === "lleno" ? t.rojo : nivel === "cerca" ? t.tinte : t.verde;
          return (
            <View key={u.etiqueta} style={s.uso}>
              <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
                {u.etiqueta}
              </Text>
              <Text
                style={[s.valor, { color: nivel === "libre" ? t.texto : color }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {u.usados}
                <Text style={{ color: t.textoSec, fontWeight: "400" }}>
                  {u.max === null ? " · sin límite" : ` / ${u.max}`}
                </Text>
              </Text>
              {u.max !== null ? (
                <View style={[s.pista, { backgroundColor: t.relleno }]}>
                  <View
                    style={[
                      s.relleno,
                      {
                        backgroundColor: color,
                        width: `${Math.min(100, (u.usados / u.max) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  caja: { padding: 14, gap: 12 },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  fila: { flexDirection: "row", gap: 14 },
  uso: { flex: 1, minWidth: 0, gap: 4 },
  valor: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"], letterSpacing: -0.3 },
  pista: { height: 5, borderRadius: 3, overflow: "hidden" },
  relleno: { height: 5, borderRadius: 3 },
});
