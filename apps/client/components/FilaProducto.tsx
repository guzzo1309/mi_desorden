import type { Producto } from "@mi-desorden/core";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { haceCuanto } from "@/lib/fecha";
import { tipo, useTema, type Tema } from "@/lib/theme";

/** Hasta dónde va la línea separadora entre filas: alineada con el texto, después de la foto. */
export const SANGRIA_FILA = 70;

export function estadoStock(t: Tema, p: Producto) {
  if (p.cantidad === 0) return { texto: "Agotado", color: t.rojo };
  if (p.cantidad < p.minimo) return { texto: "Por reponer", color: t.tinte };
  return { texto: "", color: t.texto };
}

/**
 * Fila de producto. Se ilumina un instante cuando cambia en vivo (otra persona
 * o la cámara). `categoria` se muestra solo si se pasa (fuera de las carpetas).
 */
export function FilaProducto({
  producto,
  categoria,
  onPress,
}: {
  producto: Producto;
  categoria?: string;
  onPress: () => void;
}) {
  const t = useTema();
  const brillo = useRef(new Animated.Value(0)).current;
  const anterior = useRef(producto.actualizado_en);

  useEffect(() => {
    if (anterior.current === producto.actualizado_en) return;
    anterior.current = producto.actualizado_en;
    brillo.setValue(1);
    Animated.timing(brillo, { toValue: 0, duration: 900, useNativeDriver: false }).start();
  }, [producto.actualizado_en, brillo]);

  const estado = estadoStock(t, producto);
  const fondo = brillo.interpolate({
    inputRange: [0, 1],
    outputRange: [`${t.tinte}00`, `${t.tinte}2E`], // 0 → 18 % de naranja, como el diseño
  });

  return (
    <Pressable onPress={() => (tocar(), onPress())}>
      {({ pressed }) => (
        <Animated.View style={[s.fila, { backgroundColor: pressed ? t.relleno : fondo }]}>
          {producto.foto_path ? (
            <FotoProducto ruta={producto.foto_path} tam={40} version={producto.actualizado_en} />
          ) : (
            <View style={[s.sinFoto, { backgroundColor: t.relleno }]}>
              <Icono sf="shippingbox" ion="cube-outline" size={20} color={t.textoTer} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[tipo.cuerpo, { color: t.texto, fontWeight: "500" }]} numberOfLines={1}>
              {producto.nombre}
            </Text>
            <View style={s.meta}>
              {producto.por_revisar ? (
                <Text style={[tipo.leyenda, s.nuevo, { color: t.tinte, borderColor: t.tinte }]}>
                  NUEVO
                </Text>
              ) : null}
              {producto.fuente === "camara" ? (
                <Icono sf="camera.fill" ion="videocam" size={11} color={t.textoSec} />
              ) : null}
              <Text style={[tipo.nota, { color: t.textoSec, flexShrink: 1 }]} numberOfLines={1}>
                {[producto.ubicacion, categoria, haceCuanto(producto.actualizado_en)]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[tipo.titulo3, s.numero, { color: estado.color }]}>
              {producto.cantidad}
            </Text>
            {estado.texto ? (
              <Text style={[tipo.leyenda, { color: estado.color, fontWeight: "600" }]}>
                {estado.texto}
              </Text>
            ) : null}
          </View>
          <Icono
            sf="chevron.right"
            ion="chevron-forward"
            size={13}
            color={t.textoTer}
            weight="semibold"
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 10,
  },
  sinFoto: {
    width: 40,
    height: 40,
    borderRadius: 40 * 0.22, // igual que FotoProducto
    alignItems: "center",
    justifyContent: "center",
  },
  meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  nuevo: {
    fontWeight: "700",
    fontSize: 10,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    overflow: "hidden",
  },
  numero: { fontVariant: ["tabular-nums"], fontWeight: "600" },
});
