import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BotonPrincipal, BotonVidrio, Icono, Vidrio } from "@/components/ui";
import { puedeSacarFotos, useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/**
 * Sacar la foto de un producto (/foto?id=…). Usa la misma cámara que la tab,
 * sin dependencias nativas nuevas: expo-camera devuelve el JPEG en base64 y
 * api/productos.subirFoto lo sube a Storage.
 */
export default function FotoProducto() {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { productosActivos, subirFotoProducto, miRol } = useStore();
  const producto = productosActivos.find((p) => p.id === id);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [lista, setLista] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sacar() {
    if (!camara.current || !producto || subiendo || !lista) return;
    setSubiendo(true);
    setError(null);
    try {
      if (Platform.OS !== "web")
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      // Calidad 0,5: alcanza para reconocerlo y queda bien por debajo del límite de 5 MB del bucket.
      const foto = await camara.current.takePictureAsync({
        quality: 0.5,
        base64: true,
        exif: false,
      });
      if (!foto?.base64) throw new Error("La cámara no devolvió la foto. Probá de nuevo.");
      await subirFotoProducto(producto, foto.base64);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setSubiendo(false);
    }
  }

  if (!producto) {
    return (
      <View style={[s.centro, { backgroundColor: t.fondo }]}>
        <Text style={[tipo.cuerpo, { color: t.textoSec }]}>No encontramos ese producto.</Text>
        <BotonPrincipal variante="gris" onPress={() => router.back()}>
          Volver
        </BotonPrincipal>
      </View>
    );
  }

  // La base tampoco lo deja (Storage y productos.foto_path), esto evita abrir la cámara de gusto.
  if (!puedeSacarFotos(miRol)) {
    return (
      <View style={[s.centro, { backgroundColor: t.fondo }]}>
        <Icono sf="lock.fill" ion="lock-closed" size={32} color={t.textoSec} />
        <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center", maxWidth: 320 }]}>
          Solo el dueño del inventario puede sacarle fotos a los productos.
        </Text>
        <BotonPrincipal variante="gris" onPress={() => router.back()}>
          Volver
        </BotonPrincipal>
      </View>
    );
  }

  if (!permiso) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (!permiso.granted) {
    return (
      <View style={[s.centro, { backgroundColor: t.fondo, paddingTop: insets.top }]}>
        <Icono sf="camera.fill" ion="camera" size={36} color={t.tinte} />
        <Text style={[tipo.titulo2, { color: t.texto, textAlign: "center" }]}>
          Acceso a la cámara
        </Text>
        <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center", maxWidth: 320 }]}>
          Para sacarle una foto a {producto.nombre}.
        </Text>
        <View style={{ width: "100%", maxWidth: 320, gap: 12 }}>
          {permiso.canAskAgain ? (
            <BotonPrincipal onPress={pedirPermiso}>Permitir acceso</BotonPrincipal>
          ) : (
            <BotonPrincipal onPress={() => Linking.openSettings()}>Abrir Ajustes</BotonPrincipal>
          )}
          <BotonPrincipal variante="gris" onPress={() => router.back()}>
            Cancelar
          </BotonPrincipal>
        </View>
      </View>
    );
  }

  return (
    <View style={s.fondo}>
      <CameraView
        ref={camara}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setLista(true)}
      />

      <View style={[s.arriba, { top: insets.top + 8 }]}>
        <Vidrio claro style={s.capsula}>
          <Text style={[tipo.subtitulo, s.textoClaro]} numberOfLines={1}>
            {producto.nombre}
          </Text>
        </Vidrio>
        <BotonVidrio
          claro
          etiqueta="Cancelar"
          sf="xmark"
          ion="close"
          color="#fff"
          onPress={() => router.back()}
        />
      </View>

      <View style={[s.abajo, { bottom: insets.bottom + 24 }]}>
        <Vidrio claro style={s.pista}>
          <Text style={[tipo.nota, s.textoClaro]}>
            {error ??
              (subiendo ? "Guardando la foto…" : "Encuadrá el producto y tocá el disparador")}
          </Text>
        </Vidrio>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sacar foto"
          disabled={!lista || subiendo}
          onPress={sacar}
          style={({ pressed }) => [
            s.disparador,
            { opacity: lista ? 1 : 0.5, transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}
        >
          <View style={s.disparadorInterior}>
            {subiendo ? <ActivityIndicator color="#000" /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: "#000" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  arriba: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  capsula: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    justifyContent: "center",
    flexShrink: 1,
  },
  textoClaro: { color: "#fff", fontWeight: "600" },
  abajo: { position: "absolute", left: 16, right: 16, alignItems: "center", gap: 16 },
  pista: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  disparador: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  disparadorInterior: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
