import { Pressable, StyleSheet, Text, View } from "react-native";
import { nivelCupo } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

/**
 * Cuánto lleva usado un inventario de su plan ("48 de 100 productos"), con una
 * barra. No se muestra si el plan no tiene límite. Avisa al acercarse y al llegar.
 */
export function Medidor({
  etiqueta,
  usados,
  max,
  plan,
  onMejorar,
  soloSiCerca,
}: {
  /** En plural: "productos", "personas". */
  etiqueta: string;
  usados: number;
  max: number | null;
  plan: string;
  /** Si se pasa, al llegar al límite se ofrece pedir otro plan (solo para quien puede cambiarlo). */
  onMejorar?: () => void;
  /** Solo se muestra al acercarse al límite (80 %): mientras sobra cupo, no estorba. */
  soloSiCerca?: boolean;
}) {
  const t = useTema();
  if (max === null) return null;
  const nivel = nivelCupo(usados, max);
  if (soloSiCerca && nivel === "libre") return null;
  const color = nivel === "lleno" ? t.rojo : nivel === "cerca" ? t.tinte : t.verde;
  const texto = `${usados} de ${max} ${etiqueta}`;
  const aviso =
    nivel === "lleno"
      ? `Llegaste al límite del plan ${plan}.`
      : nivel === "cerca"
        ? `Te estás acercando al límite del plan ${plan}.`
        : `Plan ${plan}`;
  return (
    <View
      accessible
      accessibilityLabel={`${texto}. ${aviso}`}
      style={[s.caja, { backgroundColor: t.celda }]}
    >
      <View style={s.fila}>
        <Text style={[tipo.subtitulo, { color: t.texto, fontVariant: ["tabular-nums"] }]}>
          {texto}
        </Text>
        <Text
          style={[tipo.nota, { color: nivel === "libre" ? t.textoSec : color }]}
          numberOfLines={1}
        >
          {aviso}
        </Text>
      </View>
      {nivel === "lleno" && onMejorar ? (
        <Pressable accessibilityRole="button" onPress={onMejorar} hitSlop={8}>
          <Text style={[tipo.subtitulo, { color: t.tinte, fontWeight: "600" }]}>
            Pedir otro plan
          </Text>
        </Pressable>
      ) : null}
      <View style={[s.pista, { backgroundColor: t.relleno }]}>
        <View
          style={[
            s.relleno,
            { backgroundColor: color, width: `${Math.min(100, (usados / max) * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  caja: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 8 },
  fila: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  pista: { height: 6, borderRadius: 3, overflow: "hidden" },
  relleno: { height: 6, borderRadius: 3 },
});
