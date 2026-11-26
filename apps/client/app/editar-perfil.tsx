import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Perfil } from "@mi-desorden/core";
import { mensajeError, perfil as perfilApi } from "@/api";
import { AvatarPerfil } from "@/components/AvatarPerfil";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  FilaEtiqueta,
  Grupo,
  tocar,
} from "@/components/ui";
import { reducirFoto } from "@/lib/imagen";
import { clavePerfil, useMiPerfil } from "@/lib/miPerfil";
import {
  errorNombre,
  errorTelefono,
  LADO_AVATAR,
  limpiarNombre,
  limpiarTelefono,
} from "@/lib/perfil";
import { useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/** Mi perfil: foto, nombre y teléfono. El correo no se cambia desde la app. */
export default function EditarPerfil() {
  const t = useTema();
  const qc = useQueryClient();
  const { usuario } = useSesion();
  const q = useMiPerfil();
  const p = q.data;

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [cargado, setCargado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Los campos arrancan con lo guardado (una sola vez: después son de quien edita).
  useEffect(() => {
    if (p && !cargado) {
      setNombre(p.nombre);
      setTelefono(p.telefono ?? "");
      setCargado(true);
    }
  }, [p, cargado]);

  const problemaNombre = errorNombre(nombre);
  const problemaTelefono = errorTelefono(telefono);
  const cambio =
    !!p &&
    (limpiarNombre(nombre) !== p.nombre || limpiarTelefono(telefono) !== (p.telefono ?? null));
  const valido = cargado && cambio && !problemaNombre && !problemaTelefono && !guardando;

  const actualizar = (nuevo: Perfil) => {
    qc.setQueryData(clavePerfil(usuario?.id), nuevo);
    // La lista de miembros muestra la foto: que la vuelva a pedir.
    void qc.invalidateQueries({ queryKey: ["inventarios"] });
  };

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      actualizar(await perfilApi.guardar({ nombre, telefono }));
      // El panel de admin también muestra el nombre.
      void qc.invalidateQueries({ queryKey: ["admin", "usuarios"] });
      router.back();
    } catch (e) {
      setError(mensajeError(e));
      setGuardando(false);
    }
  }

  async function usarFoto(origen: "galeria" | "camara") {
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
    setSubiendoFoto(true);
    setError(null);
    try {
      const { base64 } = await reducirFoto(uri, LADO_AVATAR, 0.75);
      actualizar(await perfilApi.cambiarFoto(base64));
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendoFoto(false);
    }
  }

  async function quitarFoto() {
    setSubiendoFoto(true);
    setError(null);
    try {
      actualizar(await perfilApi.quitarFoto());
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendoFoto(false);
    }
  }

  function opcionesFoto() {
    if (subiendoFoto) return;
    tocar();
    // En web no hay cámara ni hojas de acciones: directo a elegir un archivo.
    if (Platform.OS === "web") return void usarFoto("galeria");
    Alert.alert("Foto de perfil", undefined, [
      { text: "Elegir de tus fotos", onPress: () => void usarFoto("galeria") },
      { text: "Tomar foto", onPress: () => void usarFoto("camara") },
      ...(p?.avatar_path
        ? [{ text: "Quitar foto", style: "destructive" as const, onPress: () => void quitarFoto() }]
        : []),
      { text: "Cancelar", style: "cancel" as const },
    ]);
  }

  const pie =
    error ??
    (nombre && problemaNombre) ??
    (telefono && problemaTelefono) ??
    "Tu nombre y tu foto los ve la gente con la que compartes inventarios. El teléfono es opcional.";

  return (
    <>
      <Stack.Screen
        options={{
          title: "Editar perfil",
          headerLeft: () => <BotonCabecera texto="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <Contenido contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 16 }}>
        {!p ? (
          q.error ? (
            <Text style={[s.aviso, { color: t.rojo }]}>{mensajeError(q.error)}</Text>
          ) : (
            <ActivityIndicator style={{ marginTop: 40 }} />
          )
        ) : (
          <>
            <View style={s.foto}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cambiar foto de perfil"
                onPress={opcionesFoto}
                style={({ pressed }) => pressed && { opacity: 0.7 }}
              >
                <AvatarPerfil
                  nombre={limpiarNombre(nombre) || p.nombre}
                  ruta={p.avatar_path}
                  tam={96}
                />
                {subiendoFoto ? (
                  <View style={[s.cargandoFoto, { backgroundColor: "rgba(0,0,0,0.35)" }]}>
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
              </Pressable>
              <Pressable hitSlop={8} onPress={opcionesFoto} disabled={subiendoFoto}>
                <Text style={[s.cambiarFoto, { color: t.tinte, opacity: subiendoFoto ? 0.4 : 1 }]}>
                  {p.avatar_path ? "Cambiar foto" : "Agregar foto"}
                </Text>
              </Pressable>
            </View>

            <Grupo
              pie={pie}
              pieError={!!error || !!(nombre && problemaNombre) || !!(telefono && problemaTelefono)}
            >
              <CampoFila
                etiqueta="Nombre"
                placeholder="Tu nombre"
                value={nombre}
                onChangeText={(x) => (setNombre(x), setError(null))}
                autoComplete="name"
                textContentType="name"
                maxLength={60}
                returnKeyType="next"
              />
              <CampoFila
                etiqueta="Teléfono"
                placeholder="Opcional"
                value={telefono}
                onChangeText={(x) => (setTelefono(x), setError(null))}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={20}
                returnKeyType="done"
                onSubmitEditing={guardar}
              />
              <FilaEtiqueta etiqueta="Correo">
                <Text style={[tipo.cuerpo, { color: t.textoSec }]} numberOfLines={1}>
                  {p.email}
                </Text>
              </FilaEtiqueta>
            </Grupo>

            {/* En el contenido y no en el encabezado: en iOS 26 los botones del encabezado
                del modal perdían el primer toque con el teclado abierto. */}
            <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
              Guardar cambios
            </BotonPrincipal>
          </>
        )}
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  foto: { alignItems: "center", gap: 10, marginBottom: 8 },
  cargandoFoto: {
    ...StyleSheet.absoluteFill,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cambiarFoto: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  aviso: { textAlign: "center", fontSize: 15, marginTop: 40, paddingHorizontal: 24 },
});
