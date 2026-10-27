import type { LineaFactura, Producto } from "@mi-desorden/core";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
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
import { mensajeError } from "@/api";
import {
  BotonPrincipal,
  BotonVidrio,
  Contenido,
  Fila,
  Grupo,
  Icono,
  IconoCelda,
  Vidrio,
} from "@/components/ui";
import { filasDeBloques, leerFactura } from "@/lib/factura";
import { puedeEditar, useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";
import { Reconocer } from "@/modules/reconocer";

type Paso =
  | { paso: "inicio"; error?: string }
  | { paso: "camara" }
  | { paso: "leyendo" }
  | { paso: "revisar"; lineas: LineaFactura[] }
  | { paso: "cargando"; lineas: LineaFactura[] }
  | { paso: "listo"; sumados: number; nuevos: Producto[] };

/** Foto de la factura → productos, con Apple Vision en el teléfono (sin red). */
async function leerFoto(uri: string): Promise<LineaFactura[]> {
  if (!Reconocer) {
    throw new Error(
      Platform.OS === "ios"
        ? "Esta versión de la app todavía no lee facturas: hay que reinstalarla."
        : "Por ahora leer facturas con foto funciona solo en iPhone.",
    );
  }
  const lineas = leerFactura(filasDeBloques(await Reconocer.leerTexto(uri)));
  if (!lineas.length) {
    throw new Error(
      "No encontramos productos en la factura. Probá con más luz y que se vea entera y derecha.",
    );
  }
  return lineas;
}

/**
 * Cargar varios productos a la vez desde una factura (/factura). Lee la foto,
 * muestra lo que encontró y lo sube todo junto al inventario activo: a los que
 * ya están les suma la cantidad y los que no, los crea.
 */
export default function Factura() {
  const t = useTema();
  const { activo, miRol, cargarFactura } = useStore();
  const [estado, setEstado] = useState<Paso>({ paso: "inicio" });

  async function leer(uri: string) {
    setEstado({ paso: "leyendo" });
    try {
      setEstado({ paso: "revisar", lineas: await leerFoto(uri) });
    } catch (e) {
      setEstado({ paso: "inicio", error: mensajeError(e) });
    }
  }

  async function cargar(lineas: LineaFactura[]) {
    setEstado({ paso: "cargando", lineas });
    try {
      const { sumados, nuevos } = await cargarFactura(lineas);
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEstado({ paso: "listo", sumados, nuevos });
    } catch (e) {
      setEstado({ paso: "inicio", error: mensajeError(e) });
    }
  }

  if (estado.paso === "camara") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <CamaraFactura
          onFoto={(uri) => void leer(uri)}
          onCancelar={() => setEstado({ paso: "inicio" })}
        />
      </>
    );
  }

  const cancelar = (
    <Pressable onPress={() => router.back()} hitSlop={10}>
      <Text style={[tipo.cuerpo, { color: t.tinte }]}>
        {estado.paso === "listo" ? "Listo" : "Cancelar"}
      </Text>
    </Pressable>
  );

  return (
    <>
      <Stack.Screen
        options={{ headerShown: true, title: "Cargar factura", headerLeft: () => cancelar }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {!activo || !puedeEditar(miRol) ? (
          <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center" }]}>
            Necesitás ser dueño o editor del inventario para cargar productos.
          </Text>
        ) : estado.paso === "inicio" ? (
          <>
            <View style={s.cabecera}>
              <Icono sf="doc.text.viewfinder" ion="receipt-outline" size={40} color={t.tinte} />
              <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center" }]}>
                Leemos los productos y las cantidades de la factura y los sumamos a{" "}
                <Text style={{ color: t.texto, fontWeight: "600" }}>{activo.nombre}</Text>.
              </Text>
            </View>
            <Grupo pie={estado.error} pieError={!!estado.error} sangria={60}>
              <Fila
                titulo="Sacar foto de la factura"
                izquierda={<IconoCelda sf="camera.fill" ion="camera" fondo={t.tinte} />}
                chevron
                onPress={() => setEstado({ paso: "camara" })}
              />
            </Grupo>
          </>
        ) : estado.paso === "leyendo" ? (
          <View style={s.cabecera}>
            <ActivityIndicator />
            <Text style={[tipo.cuerpo, { color: t.textoSec }]}>Leyendo la factura…</Text>
          </View>
        ) : estado.paso === "revisar" || estado.paso === "cargando" ? (
          <>
            <Grupo
              titulo={`${estado.lineas.length} productos encontrados`}
              pie="A los que ya están en el inventario se les suma la cantidad; los demás se crean."
            >
              {estado.lineas.map((l) => (
                <Fila key={l.nombre} titulo={l.nombre} valor={`× ${l.cantidad}`} />
              ))}
            </Grupo>
            <BotonPrincipal
              cargando={estado.paso === "cargando"}
              onPress={() => void cargar(estado.lineas)}
            >
              {`Cargar ${estado.lineas.length} productos`}
            </BotonPrincipal>
            <BotonPrincipal
              variante="gris"
              deshabilitado={estado.paso === "cargando"}
              onPress={() => setEstado({ paso: "inicio" })}
            >
              Leer otra factura
            </BotonPrincipal>
          </>
        ) : (
          <>
            <View style={s.cabecera}>
              <Icono sf="checkmark.circle.fill" ion="checkmark-circle" size={44} color={t.verde} />
              <Text style={[tipo.titulo2, { color: t.texto }]}>Factura cargada</Text>
              <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center" }]}>
                {resumenCarga(estado.sumados, estado.nuevos.length)}
              </Text>
            </View>
            {estado.nuevos.length ? (
              <Grupo titulo="Nuevos" pie="Quedaron sin categoría hasta que alguien les asigne una.">
                {estado.nuevos.map((p) => (
                  <Fila key={p.id} titulo={p.nombre} valor={`× ${p.cantidad}`} />
                ))}
              </Grupo>
            ) : null}
            <BotonPrincipal onPress={() => router.back()}>Listo</BotonPrincipal>
          </>
        )}
      </Contenido>
    </>
  );
}

function resumenCarga(sumados: number, nuevos: number): string {
  const partes = [
    sumados ? `${sumados} ${sumados === 1 ? "producto sumó" : "productos sumaron"} stock` : "",
    nuevos ? `${nuevos} ${nuevos === 1 ? "es nuevo" : "son nuevos"}` : "",
  ].filter(Boolean);
  return partes.join(" y ") + ".";
}

/** Cámara a pantalla completa para fotografiar la factura. */
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
            Encuadrá la factura entera, derecha y con buena luz
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
  cabecera: { alignItems: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 16 },
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
