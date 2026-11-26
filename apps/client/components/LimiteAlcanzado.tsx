import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { BotonPrincipal, Icono } from "@/components/ui";
import { tipo, useTema } from "@/lib/theme";

/**
 * Lo que se ve en vez del formulario de crear cuando el plan ya no da para más:
 * qué se alcanzó y, si la persona puede, el botón para mejorar el plan. Así no se
 * llena un formulario que la base después rechaza.
 */
export function LimiteAlcanzado({
  plan,
  max,
  uno,
  varios,
  puedeMejorar,
}: {
  /** Nombre del plan (Free, Pro…). */
  plan: string;
  max: number;
  /** "inventario" / "inventarios", "categoría" / "categorías". */
  uno: string;
  varios: string;
  /** Solo el owner cambia el plan; los demás se lo piden. */
  puedeMejorar: boolean;
}) {
  const t = useTema();
  const cuanto = `${max.toLocaleString("es")} ${max === 1 ? uno : varios}`;

  const texto = !puedeMejorar
    ? `El plan ${plan} de este inventario permite ${cuanto}. Pídele al owner que mejore el plan para crear más.`
    : `Tu plan ${plan} permite ${cuanto}. Mejora tu plan para crear más.`;

  return (
    <View style={s.caja}>
      <View style={[s.icono, { backgroundColor: `${t.tinte}1F` }]}>
        <Icono sf="lock.fill" ion="lock-closed" size={30} color={t.tinte} />
      </View>
      <Text style={[tipo.titulo3, { color: t.texto, textAlign: "center" }]}>
        Llegaste al límite de tu plan
      </Text>
      <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center", maxWidth: 320 }]}>
        {texto}
      </Text>
      {puedeMejorar ? (
        <View style={s.boton}>
          <BotonPrincipal onPress={() => router.replace("/pedir-plan")}>
            Mejorar plan
          </BotonPrincipal>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  caja: { alignItems: "center", gap: 12, paddingTop: 48, paddingHorizontal: 24 },
  icono: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  boton: { alignSelf: "stretch", marginTop: 12 },
});
