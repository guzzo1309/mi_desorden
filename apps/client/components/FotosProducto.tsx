import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { FOTOS_IDEALES, MAX_FOTOS } from "@/lib/fotos";
import { tipo, useTema } from "@/lib/theme";

/** Una foto de la fila: ya guardada (ruta en Storage) o todavía local (uri del teléfono). */
export interface FotoSlot {
  clave: string;
  ruta?: string;
  uri?: string;
}

const HUECO = 10;
/** Fotos por fila: con más, la grilla sigue en otra fila. */
const COLUMNAS = 3;
const MARGEN = 12;
/** Radio concéntrico con la tarjeta del grupo (26 − margen). */
const RADIO = 26 - MARGEN;
/** Margen lateral de la pantalla (Contenido) a cada lado de la tarjeta. */
const MARGEN_PANTALLA = 16;

/**
 * Las fotos del producto en una grilla de 3 por fila: la primera es la principal.
 * Hasta las 3 recomendadas se ve un hueco por cada una que falta; después, uno
 * solo para sumar más (hasta MAX_FOTOS); con `onQuitar` cada foto trae su ✕. Con 2 o 3 fotos desde
 * distintos ángulos el modelo reconoce el producto mejor.
 */
export function FotosProducto({
  fotos,
  onAgregar,
  onQuitar,
}: {
  fotos: FotoSlot[];
  /** Sin esto no hay tiles vacíos (no se pueden agregar fotos). */
  onAgregar?: () => void;
  onQuitar?: (foto: FotoSlot) => void;
}) {
  const t = useTema();
  // Antes de medir se estima con el ancho de la pantalla: así la fila no nace en
  // altura 0 y no empuja lo de abajo (el menú nativo de categoría quedaba corrido).
  const pantalla = useWindowDimensions().width - MARGEN_PANTALLA * 2;
  const [ancho, setAncho] = useState(pantalla);
  // onLayout da el ancho con el padding incluido: se descuenta antes de repartir.
  const lado = Math.floor((ancho - MARGEN * 2 - HUECO * (COLUMNAS - 1)) / COLUMNAS);
  // Hasta las ideales, un hueco por cada foto que falta; después, uno solo para sumar más.
  const vacios = !onAgregar
    ? 0
    : fotos.length < FOTOS_IDEALES
      ? FOTOS_IDEALES - fotos.length
      : fotos.length < MAX_FOTOS
        ? 1
        : 0;

  return (
    <View style={s.fila} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {lado
        ? fotos.map((f, i) => (
            <View key={f.clave} style={{ width: lado, height: lado }}>
              {f.ruta ? (
                <FotoProducto ruta={f.ruta} tam={lado} radio={RADIO} />
              ) : (
                <Image
                  source={{ uri: f.uri }}
                  style={{ width: lado, height: lado, borderRadius: RADIO }}
                />
              )}
              {i === 0 && fotos.length > 1 ? (
                <View style={[s.etiqueta, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                  <Text style={s.etiquetaTexto}>Principal</Text>
                </View>
              ) : null}
              {onQuitar ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar la foto ${i + 1}`}
                  hitSlop={8}
                  onPress={() => (tocar(), onQuitar(f))}
                  style={[s.quitar, { backgroundColor: "rgba(0,0,0,0.6)" }]}
                >
                  <Icono sf="xmark" ion="close" size={12} color="#fff" weight="bold" />
                </Pressable>
              ) : null}
            </View>
          ))
        : null}
      {lado
        ? Array.from({ length: vacios }, (_, i) => (
            <Pressable
              key={`vacio-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`Agregar la foto ${fotos.length + i + 1}`}
              onPress={() => (tocar(), onAgregar?.())}
              style={({ pressed }) => [
                s.vacio,
                {
                  width: lado,
                  height: lado,
                  borderRadius: RADIO,
                  borderColor: t.textoTer,
                  backgroundColor: pressed ? t.relleno : "transparent",
                },
              ]}
            >
              <Icono sf="camera.badge.ellipsis" ion="camera-outline" size={24} color={t.tinte} />
              <Text style={[tipo.leyenda, { color: t.textoSec }]}>
                {fotos.length < FOTOS_IDEALES ? `Foto ${fotos.length + i + 1}` : "Agregar"}
              </Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", flexWrap: "wrap", gap: HUECO, padding: MARGEN },
  vacio: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  quitar: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  etiqueta: {
    position: "absolute",
    left: 5,
    bottom: 5,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  etiquetaTexto: { color: "#fff", fontSize: 10, fontWeight: "600" },
});
