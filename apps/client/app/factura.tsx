import type { LineaFactura, Producto } from "@mi-desorden/core";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { File as Archivo } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { Stepper } from "@/components/Stepper";
import {
  filasDeBloques,
  juntarLineas,
  leerFactura,
  lineasDeTabla,
  MAX_LINEAS,
  problemaLineas,
} from "@/lib/factura";
import { leerCsv, leerXlsx } from "@/lib/xlsx";
import { useAcciones, useInventario } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";
import { Reconocer } from "@/modules/reconocer";

/** Línea que el usuario puede corregir antes de cargar (el id es solo para la lista). */
type Linea = LineaFactura & { id: number };

let proximoId = 0;
const conIds = (lineas: LineaFactura[]): Linea[] => lineas.map((l) => ({ ...l, id: proximoId++ }));

type Paso =
  | { paso: "inicio"; error?: string }
  | { paso: "camara" }
  | { paso: "leyendo" }
  | { paso: "revisar"; lineas: Linea[]; error?: string }
  | { paso: "cargando"; lineas: Linea[] }
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

/** Tipos que acepta "Subir Excel o CSV". */
const TIPOS_RECIBO = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/comma-separated-values",
  "application/csv",
];

/** Recibo digital (.xlsx o .csv) → productos. */
async function leerRecibo(archivo: DocumentPicker.DocumentPickerAsset): Promise<LineaFactura[]> {
  // En web viene el File del navegador; en el teléfono, una copia en la caché de la app.
  const bytes = new Uint8Array(
    archivo.file ? await archivo.file.arrayBuffer() : await new Archivo(archivo.uri).arrayBuffer(),
  );
  const esCsv = /\.csv$/i.test(archivo.name) || /csv/i.test(archivo.mimeType ?? "");
  if (!esCsv && !/\.xlsx$/i.test(archivo.name)) {
    throw new Error(
      "Elegí un Excel (.xlsx) o un CSV. Los .xls viejos hay que guardarlos como .xlsx.",
    );
  }
  const filas = esCsv ? leerCsv(new TextDecoder().decode(bytes)) : leerXlsx(bytes);
  const lineas = lineasDeTabla(filas);
  if (!lineas.length) {
    throw new Error(
      "No encontramos productos en el archivo. Tiene que tener una columna con el producto y otra con la cantidad.",
    );
  }
  return lineas;
}

/**
 * Cargar varios productos a la vez desde una factura (/factura). Lee la foto
 * (de la cámara o de la galería) o el recibo digital (Excel o CSV),
 * muestra lo que encontró y lo sube todo junto al inventario activo: a los que
 * ya están les suma la cantidad y los que no, los crea.
 */
export default function Factura() {
  const t = useTema();
  const { activo, permisos } = useInventario();
  const { cargarFactura } = useAcciones();
  const [estado, setEstado] = useState<Paso>({ paso: "inicio" });

  async function leer(uri: string) {
    setEstado({ paso: "leyendo" });
    try {
      setEstado({ paso: "revisar", lineas: conIds(await leerFoto(uri)) });
    } catch (e) {
      setEstado({ paso: "inicio", error: mensajeError(e) });
    }
  }

  /** Captura o foto de la factura que ya está en el teléfono. */
  async function elegirDeGaleria() {
    const elegida = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: false,
    });
    const uri = elegida.canceled ? null : elegida.assets[0]?.uri;
    if (uri) await leer(uri);
  }

  async function elegirArchivo() {
    const elegido = await DocumentPicker.getDocumentAsync({
      type: TIPOS_RECIBO,
      copyToCacheDirectory: true,
      multiple: false,
    });
    const archivo = elegido.canceled ? null : elegido.assets[0];
    if (!archivo) return;
    setEstado({ paso: "leyendo" });
    try {
      setEstado({ paso: "revisar", lineas: conIds(await leerRecibo(archivo)) });
    } catch (e) {
      setEstado({ paso: "inicio", error: mensajeError(e) });
    }
  }

  /** Corrige, borra o agrega líneas mientras se revisa. */
  function cambiarLineas(cambio: (lineas: Linea[]) => Linea[]) {
    setEstado((e) => (e.paso === "revisar" ? { paso: "revisar", lineas: cambio(e.lineas) } : e));
  }

  async function cargar(lineas: Linea[]) {
    const problema = problemaLineas(lineas);
    if (problema) {
      setEstado({ paso: "revisar", lineas, error: problema });
      return;
    }
    setEstado({ paso: "cargando", lineas });
    try {
      const { sumados, nuevos } = await cargarFactura(
        juntarLineas(lineas.map(({ nombre, cantidad }) => ({ nombre: nombre.trim(), cantidad }))),
      );
      if (Platform.OS !== "web")
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setEstado({ paso: "listo", sumados, nuevos });
    } catch (e) {
      // Si falla no se cargó nada (es todo o nada): se vuelve a la lista para reintentar.
      setEstado({ paso: "revisar", lineas, error: mensajeError(e) });
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
        {!activo || !permisos.editar_productos ? (
          <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center" }]}>
            Necesitás ser owner o editor del inventario para cargar productos.
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
              <Fila
                titulo="Elegir de la galería"
                subtitulo="Una foto o captura de la factura"
                izquierda={<IconoCelda sf="photo.on.rectangle" ion="images" fondo={t.azul} />}
                chevron
                onPress={() => void elegirDeGaleria()}
              />
              <Fila
                titulo="Subir Excel o CSV"
                subtitulo="Recibo digital con producto y cantidad"
                izquierda={<IconoCelda sf="tablecells" ion="grid-outline" fondo={t.verde} />}
                chevron
                onPress={() => void elegirArchivo()}
              />
              <Fila
                titulo="Escribir los productos"
                subtitulo="Si la factura es en papel y no se lee bien"
                izquierda={<IconoCelda sf="list.bullet" ion="list" fondo={t.violeta} />}
                chevron
                onPress={() =>
                  setEstado({ paso: "revisar", lineas: conIds([{ nombre: "", cantidad: 1 }]) })
                }
              />
            </Grupo>
          </>
        ) : estado.paso === "leyendo" ? (
          <View style={s.cabecera}>
            <ActivityIndicator />
            <Text style={[tipo.cuerpo, { color: t.textoSec }]}>Leyendo los productos…</Text>
          </View>
        ) : estado.paso === "revisar" || estado.paso === "cargando" ? (
          <>
            <Grupo
              titulo={`${estado.lineas.length} ${estado.lineas.length === 1 ? "producto" : "productos"}`}
              pie={
                (estado.paso === "revisar" && estado.error) ||
                "Revisá lo que leímos: corregí nombres y cantidades o sacá lo que no va. A los que ya están en el inventario se les suma la cantidad; los demás se crean."
              }
              pieError={estado.paso === "revisar" && !!estado.error}
            >
              {estado.lineas.map((l) => (
                <LineaEditable
                  key={l.id}
                  linea={l}
                  editable={estado.paso === "revisar"}
                  onCambio={(nueva) =>
                    cambiarLineas((ls) => ls.map((x) => (x.id === l.id ? { ...x, ...nueva } : x)))
                  }
                  onQuitar={() => cambiarLineas((ls) => ls.filter((x) => x.id !== l.id))}
                />
              ))}
              {estado.lineas.length < MAX_LINEAS && estado.paso === "revisar" ? (
                <Fila
                  titulo="Agregar producto"
                  tinte
                  izquierda={
                    <Icono sf="plus.circle.fill" ion="add-circle" size={22} color={t.verde} />
                  }
                  onPress={() =>
                    cambiarLineas((ls) => [...ls, ...conIds([{ nombre: "", cantidad: 1 }])])
                  }
                />
              ) : null}
            </Grupo>
            <BotonPrincipal
              cargando={estado.paso === "cargando"}
              deshabilitado={!estado.lineas.length}
              onPress={() => void cargar(estado.lineas)}
            >
              {estado.lineas.length === 1
                ? "Cargar 1 producto"
                : `Cargar ${estado.lineas.length} productos`}
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
              <Grupo
                titulo="Nuevos"
                pie={
                  permisos.gestionar_fotos
                    ? "Quedaron sin categoría ni foto: te aparecen arriba en el inventario para que los completes."
                    : "Quedaron sin categoría ni foto: le avisamos al owner del inventario para que los complete."
                }
              >
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

/** Una línea de la factura: nombre editable, cantidad con − / + y botón para sacarla. */
function LineaEditable({
  linea,
  editable,
  onCambio,
  onQuitar,
}: {
  linea: Linea;
  editable: boolean;
  onCambio: (cambio: Partial<LineaFactura>) => void;
  onQuitar: () => void;
}) {
  const t = useTema();
  return (
    <View style={s.linea}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Quitar ${linea.nombre || "producto"}`}
        disabled={!editable}
        hitSlop={8}
        onPress={onQuitar}
      >
        <Icono sf="minus.circle.fill" ion="remove-circle" size={22} color={t.rojo} />
      </Pressable>
      <TextInput
        value={linea.nombre}
        onChangeText={(nombre) => onCambio({ nombre })}
        placeholder="Producto"
        placeholderTextColor={t.textoTer}
        selectionColor={t.tinte}
        editable={editable}
        maxLength={120}
        style={[
          tipo.cuerpo,
          s.lineaNombre,
          { color: t.texto },
          Platform.OS === "web" && ({ outlineStyle: "none" } as object),
        ]}
      />
      <Text style={[tipo.cuerpo, s.lineaCantidad, { color: t.texto }]}>{linea.cantidad}</Text>
      <Stepper valor={linea.cantidad} min={1} onCambio={(cantidad) => onCambio({ cantidad })} />
    </View>
  );
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
  linea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  lineaNombre: { flex: 1, minWidth: 0, paddingVertical: 0 },
  lineaCantidad: { minWidth: 24, textAlign: "right", fontVariant: ["tabular-nums"] },
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
