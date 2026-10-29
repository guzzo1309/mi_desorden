import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { Separador, Tarjeta } from "@/components/vistas";
import { tipo, useTema } from "@/lib/theme";

export interface Paso {
  titulo: string;
  detalle: string;
  hecho: boolean;
  /** Se puede saltear: no cuenta como "siguiente". */
  opcional?: boolean;
  /** Sin `onPress` el paso no se puede tocar todavía (depende de uno anterior). */
  onPress?: () => void;
}

/**
 * Guía para un inventario vacío: qué hacer y en qué orden, con lo que ya se hizo
 * tildado. El primer paso pendiente (que no sea opcional) se destaca.
 */
export function PrimerosPasos({ pasos }: { pasos: Paso[] }) {
  const t = useTema();
  const siguiente = pasos.findIndex((p) => !p.hecho && !p.opcional);
  return (
    <Tarjeta>
      <View style={s.cabecera}>
        <Text style={[tipo.titulo3, { color: t.texto }]}>Armá tu inventario</Text>
        <Text style={[tipo.subtitulo, { color: t.textoSec }]}>
          Tres pasos y ya podés contar stock con la cámara.
        </Text>
      </View>
      {pasos.map((p, i) => {
        const activo = i === siguiente;
        const toca = !!p.onPress && !p.hecho;
        return (
          <View key={p.titulo}>
            <Separador />
            <Pressable
              disabled={!toca}
              accessibilityRole={toca ? "button" : undefined}
              accessibilityLabel={`Paso ${i + 1}: ${p.titulo}. ${p.hecho ? "Hecho" : p.opcional ? "Opcional" : ""}`}
              onPress={() => (tocar(), p.onPress?.())}
              style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
            >
              <View
                style={[
                  s.circulo,
                  p.hecho
                    ? { backgroundColor: t.verde }
                    : activo
                      ? { backgroundColor: t.tinte }
                      : { backgroundColor: t.relleno },
                ]}
              >
                {p.hecho ? (
                  <Icono sf="checkmark" ion="checkmark" size={15} color="#fff" weight="bold" />
                ) : (
                  <Text style={[s.numero, { color: activo ? "#fff" : t.textoSec }]}>{i + 1}</Text>
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text
                  style={[
                    tipo.destacado,
                    { color: p.hecho || !toca ? t.textoSec : t.texto },
                    p.hecho && { textDecorationLine: "line-through" },
                  ]}
                  numberOfLines={1}
                >
                  {p.titulo}
                  {p.opcional && !p.hecho ? "  ·  opcional" : ""}
                </Text>
                <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={2}>
                  {p.detalle}
                </Text>
              </View>
              {toca ? (
                <Icono
                  sf="chevron.right"
                  ion="chevron-forward"
                  size={13}
                  color={t.textoTer}
                  weight="semibold"
                />
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </Tarjeta>
  );
}

const s = StyleSheet.create({
  cabecera: { padding: 16, gap: 4 },
  fila: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  circulo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  numero: { fontSize: 15, fontWeight: "700" },
});
