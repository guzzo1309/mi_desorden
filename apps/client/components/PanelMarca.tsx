import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Text, View } from "react-native";
import { tipo, useTema } from "@/lib/theme";

type NombreIcono = ComponentProps<typeof Ionicons>["name"];

const PUNTOS: { icono: NombreIcono; texto: string }[] = [
  { icono: "camera-outline", texto: "Apunta a la estantería y la app reconoce los productos." },
  { icono: "people-outline", texto: "Comparte tus inventarios con tu equipo." },
  { icono: "flash-outline", texto: "Los cambios se ven en vivo para todos." },
];

export function PanelMarca() {
  const t = useTema();
  return (
    <View
      style={{
        flex: 1,
        maxWidth: 560,
        backgroundColor: t.tinte,
        padding: 56,
        justifyContent: "center",
        gap: 40,
      }}
    >
      <View style={{ gap: 16 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.2)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="cube" size={34} color="#FFFFFF" />
        </View>
        <Text style={[tipo.tituloGrande, { color: "#FFFFFF" }]}>mi_desorden</Text>
        <Text style={[tipo.titulo3, { color: "rgba(255,255,255,0.9)", fontWeight: "400" }]}>
          Tu inventario, contado por la cámara.
        </Text>
      </View>
      <View style={{ gap: 20 }}>
        {PUNTOS.map((p) => (
          <View key={p.texto} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Ionicons name={p.icono} size={24} color="#FFFFFF" />
            <Text style={[tipo.cuerpo, { color: "#FFFFFF", flex: 1 }]}>{p.texto}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
