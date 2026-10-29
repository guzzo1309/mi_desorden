import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { MAX_FOTOS } from "@/lib/fotos";
import { tipo, useTema } from "@/lib/theme";

/** Una foto de la fila: ya guardada (ruta en Storage) o todavía local (uri del teléfono). */
export interface FotoSlot {
  clave: string;
  ruta?: string;
  uri?: string;
}

const HUECO = 10;

/**
 * Hasta 3 fotos del producto en una fila: la primera es la principal. Las vacías
 * invitan a sumar otra; con `onQuitar` cada foto trae su ✕. Con 2 o 3 fotos desde
 * distintos ángulos el modelo reconoce el producto mejor.
 */
export function FotosProducto({
  fotos,
  version,
  onAgregar,
  onQuitar,
}: {
  fotos: FotoSlot[];
  /** Cambia cuando se reemplaza una foto en la misma ruta: renueva la miniatura. */
  version?: string;
  /** Sin esto no hay tiles vacíos (no se pueden agregar fotos). */
  onAgregar?: () => void;
  onQuitar?: (foto: FotoSlot) => void;
}) {
  const t = useTema();
  const [ancho, setAncho] = useState(0);
  const lado = ancho ? Math.floor((ancho - HUECO * (MAX_FOTOS - 1)) / MAX_FOTOS) : 0;
  const vacios = onAgregar ? MAX_FOTOS - fotos.length : 0;

  return (
    <View style={s.fila} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {lado
        ? fotos.map((f, i) => (
            <View key={f.clave} style={{ width: lado, height: lado }}>
              {f.ruta ? (
                <FotoProducto ruta={f.ruta} tam={lado} version={version} />
              ) : (
                <Image
                  source={{ uri: f.uri }}
                  style={{ width: lado, height: lado, borderRadius: lado * 0.22 }}
                />
              )}
              {i === 0 ? (
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
                  borderRadius: lado * 0.22,
                  borderColor: t.textoTer,
                  backgroundColor: pressed ? t.relleno : "transparent",
                },
              ]}
            >
              <Icono sf="camera.badge.ellipsis" ion="camera-outline" size={24} color={t.tinte} />
              <Text style={[tipo.leyenda, { color: t.textoSec }]}>Foto {fotos.length + i + 1}</Text>
            </Pressable>
          ))
        : null}
    </View>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", gap: HUECO, padding: 14 },
  vacio: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  quitar: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  etiqueta: {
    position: "absolute",
    left: 6,
    bottom: 6,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  etiquetaTexto: { color: "#fff", fontSize: 11, fontWeight: "600" },
});
