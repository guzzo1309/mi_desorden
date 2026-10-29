import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from "expo-router/ui";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";
import { useEsAncho } from "@/lib/pantalla";
import { admin } from "@/api";
import { useInventario, useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

type NombreIcono = ComponentProps<typeof Ionicons>["name"];

// Sin `ref`: con los tipos estrictos de RN 0.88 la ref del trigger no coincide
// con la de Pressable, y el botón no la necesita.
type BotonPestanaProps = Omit<TabTriggerSlotProps, "ref"> & {
  etiqueta: string;
  icono: NombreIcono;
  iconoActivo: NombreIcono;
  lateral: boolean;
  /** Número para avisar algo pendiente (ej. productos por categorizar). */
  insignia?: number;
};

function BotonPestana({
  etiqueta,
  icono,
  iconoActivo,
  lateral,
  insignia,
  isFocused,
  ...props
}: BotonPestanaProps) {
  const t = useTema();
  const color = isFocused ? t.tinte : t.textoSec;
  return (
    <Pressable
      {...props}
      style={[
        lateral
          ? {
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 10,
            }
          : { flex: 1, alignItems: "center", gap: 2, paddingVertical: 6 },
        lateral && isFocused && { backgroundColor: t.relleno },
      ]}
    >
      <Ionicons name={isFocused ? iconoActivo : icono} size={lateral ? 22 : 24} color={color} />
      <Text
        style={[
          lateral ? tipo.cuerpo : tipo.leyenda,
          { color: lateral && isFocused ? t.texto : color, fontWeight: isFocused ? "600" : "400" },
        ]}
      >
        {etiqueta}
      </Text>
      {insignia ? (
        <View
          style={{
            minWidth: 18,
            height: 18,
            paddingHorizontal: 5,
            borderRadius: 9,
            backgroundColor: t.rojo,
            alignItems: "center",
            justifyContent: "center",
            ...(lateral ? { marginLeft: "auto" } : { position: "absolute", top: 2, left: "55%" }),
          }}
        >
          <Text style={[tipo.leyenda, { color: "#FFFFFF", fontWeight: "600" }]}>{insignia}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const t = useTema();
  const lateral = useEsAncho();
  const { esAdmin } = useSesion();
  const { data: pedidos } = useQuery({
    queryKey: ["admin", "pedidos"],
    queryFn: admin.pedidos,
    enabled: esAdmin,
  });
  const { porRevisar } = useInventario();

  return (
    <Tabs
      style={{
        flex: 1,
        flexDirection: lateral ? "row-reverse" : "column",
        backgroundColor: t.fondo,
      }}
    >
      <TabSlot style={{ flex: 1 }} />
      <TabList
        style={
          lateral
            ? {
                width: 240,
                flexDirection: "column",
                justifyContent: "flex-start",
                gap: 4,
                paddingTop: 24,
                paddingHorizontal: 12,
                backgroundColor: t.celda,
                borderRightWidth: 1,
                borderColor: t.separador,
              }
            : {
                flexDirection: "row",
                backgroundColor: t.celda,
                borderTopWidth: 1,
                borderColor: t.separador,
              }
        }
      >
        {lateral && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 12,
              marginBottom: 20,
            }}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                backgroundColor: t.tinte,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="cube" size={18} color="#FFFFFF" />
            </View>
            <Text style={[tipo.destacado, { color: t.texto }]}>mi_desorden</Text>
          </View>
        )}
        {esAdmin ? (
          <>
            <TabTrigger name="resumen" href="/(tabs)/(resumen)" asChild>
              <BotonPestana
                etiqueta="Resumen"
                icono="stats-chart-outline"
                iconoActivo="stats-chart"
                lateral={lateral}
              />
            </TabTrigger>
            <TabTrigger name="usuarios" href="/(tabs)/(usuarios)" asChild>
              <BotonPestana
                etiqueta="Usuarios"
                icono="people-outline"
                iconoActivo="people"
                lateral={lateral}
              />
            </TabTrigger>
            <TabTrigger name="planes" href="/(tabs)/(planes)" asChild>
              <BotonPestana
                etiqueta="Planes"
                icono="layers-outline"
                iconoActivo="layers"
                lateral={lateral}
                insignia={pedidos?.length}
              />
            </TabTrigger>
          </>
        ) : (
          <>
            <TabTrigger name="inventario" href="/(tabs)/(inventario)" asChild>
              <BotonPestana
                etiqueta="Inventario"
                icono="cube-outline"
                iconoActivo="cube"
                lateral={lateral}
                insignia={porRevisar.length}
              />
            </TabTrigger>
            <TabTrigger name="camara" href="/camara" asChild>
              <BotonPestana
                etiqueta="Cámara"
                icono="camera-outline"
                iconoActivo="camera"
                lateral={lateral}
              />
            </TabTrigger>
            <TabTrigger name="accesos" href="/(tabs)/(accesos)" asChild>
              <BotonPestana
                etiqueta="Accesos"
                icono="people-outline"
                iconoActivo="people"
                lateral={lateral}
              />
            </TabTrigger>
          </>
        )}
        <TabTrigger name="perfil" href="/(tabs)/(perfil)" asChild>
          <BotonPestana
            etiqueta="Perfil"
            icono="person-circle-outline"
            iconoActivo="person-circle"
            lateral={lateral}
          />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}
