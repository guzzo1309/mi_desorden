import type { Producto } from "@mi-desorden/core";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { haceCuanto } from "@/lib/fecha";
import { esReciente, nombreLugar } from "@/lib/texto";
import { fuenteMarca, tipo, useTema, type Tema } from "@/lib/theme";

/** Hasta dónde va la línea separadora entre filas: alineada con el texto, después de la foto. */
export const SANGRIA_FILA = 74;

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

  const lugar = nombreLugar(producto.ubicacion);
  // La fecha solo suma si es de hoy ("hace 5 min"): una fecha vieja igual en
  // todas las filas es ruido. La completa está en la ficha.
  const cuando = esReciente(producto.actualizado_en) ? haceCuanto(producto.actualizado_en) : "";
  const detalle = [categoria, cuando].filter(Boolean).join(" · ");
  const unidades = `${producto.cantidad} ${producto.cantidad === 1 ? "unidad" : "unidades"}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[producto.nombre, unidades, estado.texto, lugar && `en ${lugar}`]
        .filter(Boolean)
        .join(", ")}
      accessibilityHint="Abre la ficha del producto"
      onPress={() => (tocar(), onPress())}
    >
      {({ pressed }) => (
        <Animated.View style={[s.fila, { backgroundColor: pressed ? t.relleno : fondo }]}>
          {producto.foto_path ? (
            <FotoProducto ruta={producto.foto_path} tam={TAM_FOTO} />
          ) : (
            <View style={[s.sinFoto, { backgroundColor: t.relleno }]}>
              <Icono sf="shippingbox" ion="cube-outline" size={20} color={t.textoTer} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
            <View style={s.titulo}>
              <Text
                style={[tipo.cuerpo, { color: t.texto, fontWeight: "600", flexShrink: 1 }]}
                numberOfLines={1}
              >
                {producto.nombre}
              </Text>
              {producto.por_revisar ? (
                <Text style={[s.nuevo, { color: t.sobreTinte, backgroundColor: t.tinte }]}>
                  Nuevo
                </Text>
              ) : null}
            </View>
            {lugar || detalle ? (
              <View style={s.meta}>
                {lugar ? (
                  <>
                    <Icono sf="mappin" ion="location-outline" size={12} color={t.textoSec} />
                    <Text style={[tipo.nota, { color: t.textoSec, flexShrink: 1 }]} numberOfLines={1}>
                      {lugar}
                    </Text>
                  </>
                ) : null}
                {detalle ? (
                  <Text style={[tipo.nota, { color: t.textoTer, flexShrink: 1 }]} numberOfLines={1}>
                    {lugar ? "· " : ""}
                    {detalle}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <View style={s.stock}>
            <Text style={[s.numero, { color: estado.texto ? estado.color : t.texto }]}>
              {producto.cantidad}
            </Text>
            {estado.texto ? (
              <Text style={[s.estado, { color: estado.color, backgroundColor: `${estado.color}1F` }]}>
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

const TAM_FOTO = 44;

const s = StyleSheet.create({
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 68,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 12,
  },
  sinFoto: {
    width: TAM_FOTO,
    height: TAM_FOTO,
    borderRadius: TAM_FOTO * 0.22, // igual que FotoProducto
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  nuevo: {
    fontSize: 11,
    fontWeight: "700",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
  stock: { alignItems: "flex-end", gap: 3 },
  numero: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: fuenteMarca,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.3,
  },
  estado: {
    fontSize: 11,
    fontWeight: "600",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
  },
});
