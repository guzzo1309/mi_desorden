import type { Rol } from "@mi-desorden/core";
import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Icono, tocar, type SFSymbol } from "@/components/ui";
import { tipo, useTema, type Tema } from "@/lib/theme";

/**
 * Tarjeta de la vista principal que muestra mi rol en el inventario activo
 * y qué puedo hacer con él. El dueño (administrador) además ve un acceso
 * directo a Accesos.
 */

type InfoRol = {
  titulo: string;
  texto: string;
  sf: SFSymbol;
  ion: ComponentProps<typeof Ionicons>["name"];
  color: (t: Tema) => string;
};

const INFO: Record<Rol, InfoRol> = {
  dueño: {
    titulo: "Administrador",
    texto: "Sos el dueño: podés editar todo y decidir quién tiene acceso.",
    sf: "crown.fill",
    ion: "ribbon",
    color: (t) => t.tinte,
  },
  editor: {
    titulo: "Editor",
    texto: "Podés agregar y cambiar productos.",
    sf: "pencil",
    ion: "create-outline",
    color: (t) => t.azul,
  },
  lector: {
    titulo: "Solo lectura",
    texto: "Podés ver el inventario, pero no cambiarlo.",
    sf: "eye",
    ion: "eye-outline",
    color: (t) => t.textoSec,
  },
};

export function TarjetaRol({ rol }: { rol: Rol }) {
  const t = useTema();
  const info = INFO[rol];
  const color = info.color(t);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: t.celda,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: color,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icono sf={info.sf} ion={info.ion} size={18} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tipo.destacado, { color: t.texto }]}>{info.titulo}</Text>
        <Text style={[tipo.nota, { color: t.textoSec }]}>{info.texto}</Text>
      </View>
      {rol === "dueño" ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => (tocar(), router.push("/(tabs)/(accesos)"))}
          hitSlop={8}
        >
          <Text style={[tipo.subtitulo, { color: t.tinte, fontWeight: "600" }]}>Accesos</Text>
        </Pressable>
      ) : null}
    </View>
  );
}