import type { Rol } from "@mi-desorden/core";
import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Icono, tocar, type SFSymbol } from "@/components/ui";
import { tipo, useTema, type Tema } from "@/lib/theme";

/**
 * Tarjeta de la vista principal que muestra mi rol en el inventario activo.
 * El owner y los editores ven un panel con atajos para agregar productos y
 * categorías; solo el owner ve además Accesos.
 * El lector (usuario) ve una tarjeta simple de solo lectura.
 */

type NombreIon = ComponentProps<typeof Ionicons>["name"];

type InfoRol = {
  titulo: string;
  texto: string;
  sf: SFSymbol;
  ion: NombreIon;
  color: (t: Tema) => string;
};

const INFO: Record<Rol, InfoRol> = {
  owner: {
    titulo: "Panel del owner",
    texto: "Sos el owner: podés editar todo, sacar fotos y decidir quién tiene acceso.",
    sf: "crown.fill",
    ion: "ribbon",
    color: (t) => t.tinte,
  },
  editor: {
    titulo: "Panel de editor",
    texto: "Sos editor: podés agregar y cambiar productos, categorías y facturas.",
    sf: "pencil",
    ion: "create-outline",
    color: (t) => t.azul,
  },
  lector: {
    titulo: "Solo lectura",
    texto: "Podés ver el inventario y pedir cambios al owner o a los editores.",
    sf: "eye",
    ion: "eye-outline",
    color: (t) => t.textoSec,
  },
};

export function TarjetaRol({ rol, hayCategorias }: { rol: Rol; hayCategorias: boolean }) {
  const t = useTema();
  const info = INFO[rol];
  const color = info.color(t);
  const gestiona = rol !== "lector";

  // Sin categorías todavía: primero se crea una y sigue con el producto.
  const nuevoProducto = () =>
    hayCategorias
      ? router.push("/producto")
      : router.push({ pathname: "/categoria", params: { luego: "producto" } });

  return (
    <View
      style={{
        gap: 12,
        padding: 12,
        borderRadius: 14,
        backgroundColor: t.celda,
        borderWidth: gestiona ? 1.5 : 0,
        borderColor: gestiona ? t.tinte : "transparent",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
      </View>

      {!gestiona ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Atajo
            sf="plus.bubble"
            ion="chatbubble-ellipses-outline"
            texto="Pedir un producto"
            onPress={() => router.push({ pathname: "/solicitud", params: { tipo: "agregar" } })}
          />
        </View>
      ) : null}
      {gestiona ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Atajo sf="shippingbox" ion="cube-outline" texto="Producto" onPress={nuevoProducto} />
          <Atajo
            sf="folder.badge.plus"
            ion="folder-outline"
            texto="Categoría"
            onPress={() => router.push("/categoria")}
          />
          {rol === "owner" ? (
            <Atajo
              sf="person.2"
              ion="people-outline"
              texto="Accesos"
              onPress={() => router.push("/(tabs)/(accesos)")}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Atajo({
  sf,
  ion,
  texto,
  onPress,
}: {
  sf: SFSymbol;
  ion: NombreIon;
  texto: string;
  onPress: () => void;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: t.relleno,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icono sf={sf} ion={ion} size={15} color={t.tinte} />
      <Text style={[tipo.subtitulo, { color: t.tinte, fontWeight: "600" }]}>{texto}</Text>
    </Pressable>
  );
}
