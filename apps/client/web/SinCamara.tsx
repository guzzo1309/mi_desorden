import { Text, View } from "react-native";
import { Icono } from "@/components/ui";
import { tipo, useTema } from "@/lib/theme";

/** Lo que se ve en web donde la app usaría la cámara del teléfono. */
export function SinCamara({ texto }: { texto: string }) {
  const t = useTema();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: 24,
        backgroundColor: t.fondo,
      }}
    >
      <Icono sf="camera" ion="camera-outline" size={36} color={t.textoSec} />
      <Text style={[tipo.titulo3, { color: t.texto, textAlign: "center" }]}>
        La cámara solo está disponible en el teléfono
      </Text>
      <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center", maxWidth: 360 }]}>
        {texto}
      </Text>
    </View>
  );
}
