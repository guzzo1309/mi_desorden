import type { FuenteTitulo } from "@mi-desorden/core";
import * as ImagePicker from "expo-image-picker";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
  IconoCelda,
  tocar,
} from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { reducirFoto } from "@/lib/imagen";
import {
  COLORES_TITULO,
  FUENTES_TITULO,
  estiloTituloCatalogo,
  fontFamilyDe,
} from "@/lib/personalizacion";
import { useAcciones, useInventario } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/** Crea un inventario o edita la tarjeta de un catálogo (nombre, lugar, imagen, fuente y color). */
export default function InventarioNuevo() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const t = useTema();
  const { crearInventario, editarInventario } = useAcciones();
  const { inventarios } = useInventario();
  const existente = id ? inventarios.find((i) => i.id === id) : undefined;

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [lugar, setLugar] = useState(existente?.lugar ?? "");
  const [fuente, setFuente] = useState<FuenteTitulo | null>(existente?.fuente_titulo ?? null);
  const [color, setColor] = useState<string | null>(existente?.color_titulo ?? null);
  const [fotoLocal, setFotoLocal] = useState<{ uri: string; base64: string } | null>(null);
  const [quitarFoto, setQuitarFoto] = useState(false);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = nombre.trim().length >= 2 && !guardando;

  const tieneFotoActual = !!fotoLocal || (!!existente?.foto_path && !quitarFoto);
  const estiloPreview = estiloTituloCatalogo(
    { fuente_titulo: fuente, color_titulo: color },
    t.texto,
    Platform.OS,
  );

  async function elegirImagen() {
    tocar();
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permiso.granted) {
      setError("Necesitamos permiso para acceder a tus fotos.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    try {
      const reducida = await reducirFoto(res.assets[0].uri);
      setFotoLocal(reducida);
      setQuitarFoto(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function borrarImagen() {
    tocar();
    setFotoLocal(null);
    setQuitarFoto(true);
  }

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      if (existente) {
        await editarInventario(existente.id, nombre, lugar, {
          fuente_titulo: fuente,
          color_titulo: color,
          nuevaFotoBase64: fotoLocal?.base64 ?? null,
          quitarFoto,
        });
      } else {
        await crearInventario(nombre, lugar, {
          fuente_titulo: fuente,
          color_titulo: color,
          nuevaFotoBase64: fotoLocal?.base64 ?? null,
        });
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  const boton = (texto: string, onPress: () => void, fuerte?: boolean, apagado?: boolean) => (
    <BotonCabecera texto={texto} onPress={onPress} fuerte={fuerte} apagado={apagado} />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Editar catálogo" : "Nuevo catálogo",
          headerLeft: () => boton("Cancelar", () => router.back()),
        }}
      />
      <Contenido contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 16 }}>
        <Grupo titulo="Vista previa">
          <View style={s.preview}>
            {fotoLocal ? (
              <Image source={{ uri: fotoLocal.uri }} style={s.previewImg} resizeMode="cover" />
            ) : existente?.foto_path && !quitarFoto ? (
              <FotoProducto ruta={existente.foto_path} tam={52} radio={12} />
            ) : (
              <IconoCelda sf="shippingbox.fill" ion="cube" fondo={t.tinte} />
            )}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={[tipo.titulo3, estiloPreview]} numberOfLines={1}>
                {nombre.trim() || "Nombre del catálogo"}
              </Text>
              <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
                {lugar.trim() || "Sin ubicación"}
              </Text>
            </View>
          </View>
        </Grupo>

        <Grupo
          titulo="Datos"
          pie={
            error ??
            "Por ejemplo: Depósito, Taller o Casa. Cada catálogo tiene sus productos y su propia personalización."
          }
          pieError={!!error}
        >
          <CampoFila
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            autoFocus={!existente}
            returnKeyType="done"
            onSubmitEditing={guardar}
          />
          <CampoFila
            placeholder="Lugar (opcional)"
            value={lugar}
            onChangeText={setLugar}
            returnKeyType="done"
            onSubmitEditing={guardar}
          />
        </Grupo>

        <Grupo titulo="Imagen representativa">
          <Fila
            titulo={tieneFotoActual ? "Cambiar imagen" : "Elegir imagen"}
            valor={tieneFotoActual ? "Cargada" : "Ninguna"}
            izquierda={<IconoCelda sf="photo.fill" ion="image" fondo={t.azul} />}
            onPress={elegirImagen}
          />
          {tieneFotoActual ? (
            <Fila
              titulo="Quitar imagen"
              destructiva
              onPress={borrarImagen}
            />
          ) : null}
        </Grupo>

        <Grupo titulo="Tipo de fuente" pie="Solo puedes elegir una fuente por catálogo.">
          {FUENTES_TITULO.map((opcion) => {
            const activa = (fuente ?? "sistema") === opcion.id;
            const familia = fontFamilyDe(opcion.id, Platform.OS);
            return (
              <Pressable
                key={opcion.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: activa }}
                onPress={() => {
                  tocar();
                  setFuente(opcion.id === "sistema" ? null : opcion.id);
                }}
                style={({ pressed }) => [s.filaOpcion, pressed && { backgroundColor: t.relleno }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={[
                      tipo.cuerpo,
                      { color: t.texto },
                      familia ? { fontFamily: familia } : undefined,
                    ]}
                  >
                    {opcion.etiqueta}
                  </Text>
                  <Text style={[tipo.leyenda, { color: t.textoSec }]}>{opcion.ejemplo}</Text>
                </View>
                {activa ? (
                  <Icono sf="checkmark" ion="checkmark" size={18} color={t.tinte} weight="semibold" />
                ) : null}
              </Pressable>
            );
          })}
        </Grupo>

        <Grupo titulo="Color del título" pie="Solo puedes elegir un color por catálogo.">
          <View style={s.coloresWrap}>
            {COLORES_TITULO.map((opcion) => {
              const activa = (color ?? null) === opcion.valor;
              const muestra = opcion.valor ?? t.texto;
              return (
                <Pressable
                  key={opcion.etiqueta}
                  accessibilityRole="radio"
                  accessibilityLabel={opcion.etiqueta}
                  accessibilityState={{ selected: activa }}
                  onPress={() => {
                    tocar();
                    setColor(opcion.valor);
                  }}
                  style={s.colorItem}
                >
                  <View
                    style={[
                      s.circulo,
                      {
                        backgroundColor: muestra,
                        borderColor: activa ? t.tinte : t.separador,
                        borderWidth: activa ? 3 : 1,
                      },
                    ]}
                  >
                    {activa ? (
                      <Icono sf="checkmark" ion="checkmark" size={14} color="#fff" weight="bold" />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      tipo.leyenda,
                      { color: activa ? t.texto : t.textoSec, fontWeight: activa ? "600" : "400" },
                    ]}
                    numberOfLines={1}
                  >
                    {opcion.etiqueta}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Grupo>

        {/* En el contenido y no en el encabezado: en iOS 26 los botones del encabezado
            del modal perdían el primer toque con el teclado abierto. */}
        <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
          {existente ? "Guardar cambios" : "Crear catálogo"}
        </BotonPrincipal>
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  previewImg: {
    width: 52,
    height: 52,
    borderRadius: 12,
  },
  filaOpcion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  coloresWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  colorItem: {
    alignItems: "center",
    width: 64,
    gap: 6,
  },
  circulo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
