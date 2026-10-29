import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
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
import { facturaPendiente } from "@/lib/facturaPendiente";
import { tipo, useTema } from "@/lib/theme";

/**
 * Cámara a pantalla completa para fotografiar la factura (/factura-camara). Es su
 * propia pantalla (como /foto): al sacar la foto la deja en facturaPendiente y
 * vuelve; la pantalla de la factura la lee.
 */
export default function FacturaCamara() {
  return (
    <CamaraFactura
      onFoto={(uri) => {
        facturaPendiente.poner(uri);
        router.back();
      }}
      onCancelar={() => router.back()}
    />
  );
}

function CamaraFactura({
  onFoto,
  onCancelar,
}: {
  onFoto: (uri: string) => void;
  onCancelar: () => void;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [lista, setLista] = useState(false);
  const [sacando, setSacando] = useState(false);

  async function sacar() {
    if (!camara.current || !lista || sacando) return;
    setSacando(true);
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    // Calidad alta: la letra de una factura es chica.
    const foto = await camara.current.takePictureAsync({ quality: 0.9 }).catch(() => null);
    setSacando(false);
    if (foto?.uri) onFoto(foto.uri);
  }

  if (!permiso) return <View style={s.negro} />;

  if (!permiso.granted) {
    return (
      <View style={[s.centro, { backgroundColor: t.fondo, paddingTop: insets.top }]}>
        <Icono sf="camera.fill" ion="camera" size={36} color={t.tinte} />
        <Text style={[tipo.titulo2, { color: t.texto, textAlign: "center" }]}>
          Acceso a la cámara
        </Text>
        <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center", maxWidth: 320 }]}>
          Para sacarle una foto a la factura.
        </Text>
        <View style={{ width: "100%", maxWidth: 320, gap: 12 }}>
          {permiso.canAskAgain ? (
            <BotonPrincipal onPress={pedirPermiso}>Permitir acceso</BotonPrincipal>
          ) : (
            <BotonPrincipal onPress={() => Linking.openSettings()}>Abrir Ajustes</BotonPrincipal>
          )}
          <BotonPrincipal variante="gris" onPress={onCancelar}>
            Cancelar
          </BotonPrincipal>
        </View>
      </View>
    );
  }

  return (
    <View style={s.negro}>
      <CameraView
        ref={camara}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setLista(true)}
      />
      <View style={[s.arriba, { top: insets.top + 8 }]}>
        <BotonVidrio
          claro
          etiqueta="Cancelar"
          sf="xmark"
          ion="close"
          color="#fff"
          onPress={onCancelar}
        />
      </View>
      <View style={[s.abajo, { bottom: insets.bottom + 24 }]}>
        <Vidrio claro style={s.pista}>
          <Text style={[tipo.nota, s.textoClaro]}>
            Encuadra la factura entera, derecha y con buena luz
          </Text>
        </Vidrio>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sacar foto de la factura"
          disabled={!lista || sacando}
          onPress={sacar}
          style={({ pressed }) => [
            s.disparador,
            { opacity: lista ? 1 : 0.5, transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}
        >
          <View style={s.disparadorInterior}>
            {sacando ? <ActivityIndicator color="#000" /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  negro: { flex: 1, backgroundColor: "#000" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  arriba: { position: "absolute", right: 16, flexDirection: "row" },
  abajo: { position: "absolute", left: 16, right: 16, alignItems: "center", gap: 16 },
  pista: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  textoClaro: { color: "#fff", fontWeight: "600" },
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
