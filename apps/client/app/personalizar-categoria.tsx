import type { ColorCategoria, FuenteCategoria } from "@mi-desorden/core";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mensajeError } from "@/api";
import { familiaDe, IconoCategoria, useEstiloTitulo } from "@/components/EstiloCategoria";
import { RuedaColor } from "@/components/RuedaColor";
import {
  BotonCabecera,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
  tocar,
  Vacio,
} from "@/components/ui";
import { colorDe, COLORES, esColorLibre, FUENTES } from "@/lib/estiloCategoria";
import { GRUPOS_ICONOS, iconoPorClave } from "@/lib/iconosCategoria";
import { reducirFoto } from "@/lib/imagen";
import { useEsAncho } from "@/lib/pantalla";
import { useAcciones, useInventario } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/** La primera opción de la grilla: sin ícono elegido, la carpeta de siempre. */
const CARPETA = {
  clave: null,
  etiqueta: "Carpeta",
  sf: "folder.fill" as const,
  ion: "folder" as const,
};
/** Separación entre celdas de la grilla de íconos. */
const HUECO = 8;

/** Lado de la imagen de una categoría: se ve chica (36 pt), 512 px sobra. */
const LADO_IMAGEN = 512;

/**
 * Personalizar una categoría (solo el owner): nombre, imagen representativa, estilo
 * de letra y color del título (de la paleta o libre, con el círculo cromático). Se ve
 * cómo queda antes de guardar.
 */
export default function PersonalizarCategoria() {
  const t = useTema();
  const esAncho = useEsAncho();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { categoriasActivas, miRol } = useInventario();
  const { personalizarCategoria, renombrarCategoria } = useAcciones();
  const categoria = categoriasActivas.find((c) => c.id === id);

  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [fuente, setFuente] = useState<FuenteCategoria | null>(categoria?.fuente ?? null);
  const [icono, setIcono] = useState<string | null>(categoria?.icono ?? null);
  const [color, setColor] = useState<ColorCategoria | null>(categoria?.color ?? null);
  /** undefined = la imagen que ya tiene; null = quitarla; objeto = una nueva elegida. */
  const [imagen, setImagen] = useState<{ uri: string; base64: string } | null | undefined>();
  const [preparando, setPreparando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La rueda arranca abierta si el color guardado es uno libre.
  const [listaIconos, setListaIconos] = useState(false);
  /** Ancho de la grilla de íconos: con él, 6 celdas cuadradas por fila en cualquier pantalla. */
  const [anchoGrilla, setAnchoGrilla] = useState(0);
  const [rueda, setRueda] = useState(esColorLibre(categoria?.color));

  const estiloPrevia = useEstiloTitulo({ fuente, color });

  if (!categoria || miRol !== "owner") {
    return (
      <>
        <Stack.Screen options={{ title: "Personalizar categoría" }} />
        <Vacio
          sf="paintbrush"
          ion="brush-outline"
          titulo={categoria ? "Solo el owner personaliza" : "No encontramos la categoría"}
          texto={
            categoria
              ? "La imagen, la letra y el color de las categorías los elige el owner del inventario."
              : "Puede que la hayan eliminado."
          }
        />
      </>
    );
  }
  const c = categoria;

  const tieneImagen = imagen === undefined ? !!c.imagen_path : !!imagen;
  const nombreLimpio = nombre.trim();
  const renombra = nombreLimpio !== c.nombre;
  const cambiaEstilo =
    imagen !== undefined ||
    icono !== (c.icono ?? null) ||
    fuente !== (c.fuente ?? null) ||
    color !== (c.color ?? null);
  const colorIconos = color ? colorDe(color, t) : t.tinte;
  const etiquetaIcono = tieneImagen ? "Foto" : (iconoPorClave(icono)?.etiqueta ?? "Carpeta");

  /** Elegir un ícono saca la foto: se ve una cosa o la otra. */
  function elegirIcono(clave: string | null) {
    tocar();
    setIcono(clave);
    if (tieneImagen) setImagen(null);
  }
  const cambio = (renombra || cambiaEstilo) && nombreLimpio.length > 0;
  const libre = esColorLibre(color) ? color : null;

  async function elegirImagen(origen: "galeria" | "camara") {
    const opciones: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    };
    if (origen === "camara") {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        setError("Para tomar la foto, dale permiso a la cámara en Ajustes.");
        return;
      }
    }
    const elegida =
      origen === "camara"
        ? await ImagePicker.launchCameraAsync(opciones)
        : await ImagePicker.launchImageLibraryAsync(opciones);
    const uri = elegida.canceled ? null : elegida.assets[0]?.uri;
    if (!uri) return;
    setPreparando(true);
    setError(null);
    try {
      setImagen(await reducirFoto(uri, LADO_IMAGEN, 0.75));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setPreparando(false);
    }
  }

  function opcionesImagen() {
    if (preparando || guardando) return;
    tocar();
    if (Platform.OS === "web") return void elegirImagen("galeria");
    Alert.alert("Imagen de la categoría", undefined, [
      { text: "Elegir de tus fotos", onPress: () => void elegirImagen("galeria") },
      { text: "Tomar foto", onPress: () => void elegirImagen("camara") },
      ...(tieneImagen
        ? [{ text: "Quitar imagen", style: "destructive" as const, onPress: () => setImagen(null) }]
        : []),
      { text: "Cancelar", style: "cancel" as const },
    ]);
  }

  async function guardar() {
    if (!cambio || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      // Primero el nombre: si ya existe otra con ese nombre, no se guarda nada a medias.
      if (renombra) await renombrarCategoria(c.id, nombreLimpio);
      if (cambiaEstilo) {
        await personalizarCategoria(
          c,
          { fuente, color, icono },
          imagen === undefined ? undefined : (imagen?.base64 ?? null),
        );
      }
      router.back();
    } catch (e) {
      const mensaje = mensajeError(e);
      setError(mensaje);
      setGuardando(false);
      // El pie con el error queda arriba de todo: con la pantalla bajada no se veía.
      Alert.alert("No se pudo guardar", mensaje);
    }
  }

  const marca = (activo: boolean) =>
    activo ? (
      <Icono sf="checkmark" ion="checkmark" size={17} color={t.tinte} weight="semibold" />
    ) : undefined;

  return (
    <View
      style={[
        { flex: 1 },
        esAncho && { maxWidth: 500, width: "100%", alignSelf: "center", marginTop: 40 },
      ]}
    >
      <Stack.Screen
        options={{
          title: "Personalizar categoría",
          headerLeft: () => <BotonCabecera texto="Volver" atras onPress={() => router.back()} />,
          headerRight: () =>
            guardando ? (
              <ActivityIndicator style={{ paddingHorizontal: 16 }} />
            ) : (
              <BotonCabecera
                texto="Guardar"
                fuerte
                apagado={!cambio || preparando}
                onPress={guardar}
              />
            ),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        // Con "never" el sistema no deja lugar abajo: sin esto, Guardar quedaba pegado al borde.
        contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 48 }}
      >
        {/* Vista previa: como se va a ver la carpeta en el inventario. */}
        <Grupo titulo="Así se ve" pie={error ?? undefined} pieError={!!error}>
          <View style={s.previa}>
            <IconoCategoria
              categoria={{ imagen_path: c.imagen_path, color, icono }}
              uriLocal={imagen === undefined ? undefined : (imagen?.uri ?? null)}
              tam={24}
              colorBase={t.tinte}
            />
            <Text
              style={[tipo.destacado, { fontWeight: "700", flex: 1 }, estiloPrevia]}
              numberOfLines={1}
            >
              {nombreLimpio || c.nombre}
            </Text>
          </View>
        </Grupo>

        <Grupo titulo="Nombre">
          <CampoFila
            placeholder="Nombre de la categoría"
            value={nombre}
            onChangeText={(x) => (setNombre(x), setError(null))}
            maxLength={60}
            returnKeyType="done"
          />
        </Grupo>

        <Grupo
          titulo="Ícono"
          pie={
            tieneImagen
              ? "Con foto se ve la foto. Elige un ícono para usarlo en su lugar."
              : "Elige un ícono o usa una foto tuya."
          }
        >
          {/* Desplegable: cerrado muestra el ícono actual; abierto, todos por rubro. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: listaIconos }}
            accessibilityLabel={`Ícono: ${etiquetaIcono}`}
            onPress={() => (tocar(), setListaIconos((x) => !x))}
            style={({ pressed }) => [s.opcion, s.otro, pressed && { backgroundColor: t.relleno }]}
          >
            <View style={[s.muestraIcono, { backgroundColor: t.relleno }]}>
              <IconoCategoria
                categoria={{ imagen_path: c.imagen_path, color, icono }}
                uriLocal={imagen === undefined ? undefined : (imagen?.uri ?? null)}
                tam={18}
                colorBase={t.tinte}
              />
            </View>
            <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>Ícono</Text>
            <Text style={[tipo.cuerpo, { color: t.textoSec }]}>{etiquetaIcono}</Text>
            <View style={{ transform: [{ rotate: listaIconos ? "90deg" : "0deg" }] }}>
              <Icono
                sf="chevron.right"
                ion="chevron-forward"
                size={13}
                color={t.textoTer}
                weight="semibold"
              />
            </View>
          </Pressable>
          {listaIconos ? (
            <View
              style={s.iconos}
              onLayout={(e) => setAnchoGrilla(e.nativeEvent.layout.width - 28)}
            >
              {anchoGrilla > 0
                ? GRUPOS_ICONOS.map((g, gi) => (
                    <View key={g.titulo} style={{ gap: 6 }}>
                      <Text style={[tipo.nota, { color: t.textoSec }]}>{g.titulo}</Text>
                      <View style={s.grilla}>
                        {(gi === 0 ? [CARPETA, ...g.iconos] : g.iconos).map((i) => {
                          const activo = !tieneImagen && icono === i.clave;
                          const lado = Math.floor((anchoGrilla - HUECO * 5) / 6);
                          return (
                            <Pressable
                              key={i.clave ?? "carpeta"}
                              accessibilityRole="button"
                              accessibilityLabel={i.etiqueta}
                              accessibilityState={{ selected: activo }}
                              onPress={() => elegirIcono(i.clave)}
                              style={({ pressed }) => [
                                s.celdaIcono,
                                {
                                  width: lado,
                                  height: lado,
                                  backgroundColor: activo ? `${colorIconos}22` : t.relleno,
                                  borderColor: activo ? colorIconos : "transparent",
                                },
                                pressed && { opacity: 0.6 },
                              ]}
                            >
                              <Icono sf={i.sf} ion={i.ion} size={20} color={colorIconos} />
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))
                : null}
            </View>
          ) : null}
          <Fila
            titulo={tieneImagen ? "Cambiar foto" : "Usar una foto"}
            onPress={opcionesImagen}
            derecha={
              preparando ? (
                <ActivityIndicator />
              ) : (
                <Icono sf="photo" ion="image-outline" size={20} color={t.tinte} />
              )
            }
          />
        </Grupo>

        <Grupo titulo="Letra del título">
          {FUENTES.map((f) => (
            <Pressable
              key={f.valor ?? "sistema"}
              accessibilityRole="button"
              accessibilityState={{ selected: fuente === f.valor }}
              onPress={() => (tocar(), setFuente(f.valor))}
              style={({ pressed }) => [s.opcion, pressed && { backgroundColor: t.relleno }]}
            >
              <Text
                style={[tipo.cuerpo, { color: t.texto, flex: 1, fontFamily: familiaDe(f.valor) }]}
              >
                {f.etiqueta}
              </Text>
              {marca(fuente === f.valor)}
            </Pressable>
          ))}
        </Grupo>

        <Grupo titulo="Color del título">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.colores}
          >
            {COLORES.map((k) => {
              const activo = color === k.valor;
              const muestra = colorDe(k.valor, t);
              return (
                <Pressable
                  key={k.valor ?? "normal"}
                  accessibilityRole="button"
                  accessibilityLabel={k.etiqueta}
                  accessibilityState={{ selected: activo }}
                  onPress={() => (tocar(), setColor(k.valor))}
                  style={s.color}
                >
                  <View style={[s.anillo, { borderColor: activo ? muestra : "transparent" }]}>
                    <View style={[s.punto, { backgroundColor: muestra }]} />
                  </View>
                  <Text style={[tipo.nota, { color: activo ? t.texto : t.textoSec }]}>
                    {k.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: rueda, selected: !!libre }}
            onPress={() => (tocar(), setRueda((x) => !x))}
            style={({ pressed }) => [s.opcion, s.otro, pressed && { backgroundColor: t.relleno }]}
          >
            <View style={[s.anilloChico, { borderColor: libre ?? "transparent" }]}>
              <View style={s.arcoiris} />
            </View>
            <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>
              {libre ? `Color propio · ${libre}` : "Más colores"}
            </Text>
            {libre ? marca(true) : null}
            <View style={{ transform: [{ rotate: rueda ? "90deg" : "0deg" }] }}>
              <Icono
                sf="chevron.right"
                ion="chevron-forward"
                size={13}
                color={t.textoTer}
                weight="semibold"
              />
            </View>
          </Pressable>
          {rueda ? <RuedaColor valor={libre} onCambio={setColor} /> : null}
        </Grupo>
      </Contenido>
    </View>
  );
}

const s = StyleSheet.create({
  previa: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  opcion: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  colores: { flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingVertical: 14 },
  color: { alignItems: "center", gap: 4, width: 62 },
  anillo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  punto: { width: 28, height: 28, borderRadius: 14 },
  otro: { gap: 12 },
  iconos: { gap: 12, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: HUECO },
  muestraIcono: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  celdaIcono: {
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  anilloChico: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  arcoiris: {
    width: 24,
    height: 24,
    borderRadius: 12,
    experimental_backgroundImage:
      "linear-gradient(135deg, #FF3B30, #FFCC00, #34C759, #00C7BE, #007AFF, #AF52DE, #FF2D55)",
  },
});
