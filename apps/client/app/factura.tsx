import type { LineaFactura, Producto } from "@mi-desorden/core";
import * as DocumentPicker from "expo-document-picker";
import { File as Archivo } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { mensajeError } from "@/api";
import {
  BotonCabecera,
  BotonPrincipal,
  Contenido,
  Fila,
  Grupo,
  Icono,
  IconoCelda,
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
import { facturaPendiente } from "@/lib/facturaPendiente";
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
      "No encontramos productos en la factura. Prueba con más luz y que se vea entera y derecha.",
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
      "Elige un Excel (.xlsx) o un CSV. Los .xls viejos hay que guardarlos como .xlsx.",
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

  // Al volver de la cámara, lee la foto que sacó (la cámara es su propia pantalla).
  useFocusEffect(
    useCallback(() => {
      const uri = facturaPendiente.tomar();
      if (uri) void leer(uri);
    }, []),
  );

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

  const cancelar = (
    <BotonCabecera
      texto={estado.paso === "listo" ? "Listo" : "Cancelar"}
      onPress={() => router.back()}
    />
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
            Necesitas ser owner o editor del inventario para cargar productos.
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
                onPress={() => router.push("/factura-camara")}
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
                "Revisa lo que leímos: corrige nombres y cantidades o saca lo que no va. A los que ya están en el inventario se les suma la cantidad; los demás se crean."
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
                    ? "Les falta categoría, lugar y fotos. Complétalos ahora uno por uno para que la cámara los reconozca, o más tarde desde el inventario."
                    : "Quedaron sin categoría ni foto: le avisamos al owner del inventario para que los complete."
                }
              >
                {estado.nuevos.map((p) => (
                  <Fila key={p.id} titulo={p.nombre} valor={`× ${p.cantidad}`} />
                ))}
              </Grupo>
            ) : null}
            {estado.nuevos.length && permisos.gestionar_fotos ? (
              <>
                <BotonPrincipal onPress={() => router.replace("/revision")}>
                  Completar ahora, uno por uno
                </BotonPrincipal>
                <BotonPrincipal variante="gris" onPress={() => router.back()}>
                  Más tarde
                </BotonPrincipal>
              </>
            ) : (
              <BotonPrincipal onPress={() => router.back()}>Listo</BotonPrincipal>
            )}
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
});
