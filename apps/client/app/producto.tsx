import { useEsAncho } from '@/lib/pantalla';
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View, Platform, Alert } from "react-native";
import { MenuCategoria } from "@/components/menus";
import { Stepper } from "@/components/Stepper";
import { FotoProducto } from "@/components/vistas";
import { BotonPrincipal, CampoFila, Contenido, Fila, Grupo } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { haceCuanto } from "@/lib/fecha";
import { puedeEditar, useStore } from "@/lib/store";
import { fotoPendiente } from "@/lib/fotoPendiente";
import { tipo, useTema } from "@/lib/theme";


export default function ProductoForm() {
  const esAncho = useEsAncho();
  const t = useTema();
  // categoria: preelegida al crear desde una carpeta.
  // nombre + desdeCamara: la cámara no lo reconoció y propone agregarlo con su foto.
  const params = useLocalSearchParams<{
    id?: string;
    categoria?: string;
    nombre?: string;
    desdeCamara?: string;
  }>();
  const id = params.id;
  const {
    productosActivos,
    categoriasActivas,
    guardarProducto,
    eliminarProducto,
    quitarFotoProducto,
    subirFotoProducto,
    miRol,
  } = useStore();
  const existente = id ? productosActivos.find((p) => p.id === id) : undefined;
  const editable = puedeEditar(miRol);
  const manejarSolicitudEliminar = () => {
    if (!existente) return;
    
    const enviar = () => {
      // Si tienes la función en el store, la llamas aquí; o puedes lanzar la alerta
      if (Platform.OS === 'web') {
        window.alert("Solicitud enviada al administrador.");
      } else {
        Alert.alert("Enviado", "Se le ha notificado al administrador.");
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`¿Deseas pedirle al administrador que elimine "${existente.nombre}"?`)) {
        enviar();
      }
    } else {
      Alert.alert(
        "Solicitar eliminación",
        `¿Deseas enviar una solicitud al administrador para eliminar "${existente.nombre}"?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Enviar solicitud", onPress: enviar }
        ]
      );
    }
  };

  const [nombre, setNombre] = useState(existente?.nombre ?? params.nombre ?? "");
  // La foto que sacó la cámara (solo al crear desde ahí).
  const [fotoCamara] = useState(() =>
    !existente && params.desdeCamara === "1" ? fotoPendiente.ver() : null,
  );
  const [categoriaId, setCategoriaId] = useState<string | null>(
    existente?.categoria_id ?? params.categoria ?? null,
  );
  const categoriaValida = !!categoriaId && categoriasActivas.some((c) => c.id === categoriaId);
  const [cantidad, setCantidad] = useState(existente?.cantidad ?? 1);
  const [minimo, setMinimo] = useState(existente?.minimo ?? 1);
  const [ubicacion, setUbicacion] = useState(existente?.ubicacion ?? "");
  const [fotoError, setFotoError] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido =
    nombre.trim().length > 0 && ubicacion.trim().length > 0 && categoriaValida && !guardando;

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      const guardado = await guardarProducto(existente?.id ?? null, {
        nombre: nombre.trim(),
        categoria_id: categoriaId,
        cantidad,
        minimo,
        ubicacion: ubicacion.trim().toUpperCase(),
      });
      // Nuevo desde la cámara: su foto queda como referencia para reconocerlo.
      if (fotoCamara && !existente) {
        fotoPendiente.descartar();
        await subirFotoProducto(guardado, fotoCamara.base64).catch(() => {});
      }
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  function eliminar() {
    if (!existente) return;
    confirmar(
      `¿Eliminar “${existente.nombre}”?`,
      "Se borra del inventario para todos los que tienen acceso.",
      "Eliminar",
      () => {
        eliminarProducto(existente.id)
          .then(() => router.back())
          .catch((e: Error) => setError(e.message));
      },
    );
  }

  const textoHeader = (texto: string, onPress: () => void, fuerte?: boolean, apagado?: boolean) => (
    <Pressable onPress={onPress} disabled={apagado} hitSlop={10}>
      <Text
        style={[
          tipo.cuerpo,
          { color: apagado ? t.textoTer : t.tinte, fontWeight: fuerte ? "600" : "400" },
        ]}
      >
        {texto}
      </Text>
    </Pressable>
  );

  return (
    <View style={[{ flex: 1 }, esAncho && { maxWidth: 600, width: '100%', alignSelf: 'center', marginTop: 40 }]}>
      <Stack.Screen
        options={{
          title: existente ? "Producto" : "Nuevo producto",
          headerLeft: () => textoHeader("Cancelar", () => router.back()),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <Grupo pie={error ?? undefined} pieError>
          <CampoFila
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            editable={editable}
            autoFocus={!existente}
          />
          <Fila
            titulo="Categoría"
            derecha={
              <MenuCategoria
                categorias={categoriasActivas}
                valor={categoriaValida ? categoriaId : null}
                onCambio={setCategoriaId}
                onNueva={() => router.push("/categoria")}
                editable={editable}
              />
            }
          />
        </Grupo>

        <Grupo titulo="Stock" pie="Cuando baje del mínimo lo vas a ver en “Por reponer”.">
          <Fila
            titulo="Cantidad"
            derecha={
              editable ? (
                <Numero n={cantidad} onCambio={setCantidad} />
              ) : (
                <Text style={[tipo.cuerpo, { color: t.textoSec }]}>{cantidad}</Text>
              )
            }
          />
          <Fila
            titulo="Mínimo"
            derecha={
              editable ? (
                <Numero n={minimo} onCambio={setMinimo} />
              ) : (
                <Text style={[tipo.cuerpo, { color: t.textoSec }]}>{minimo}</Text>
              )
            }
          />
        </Grupo>

        {fotoCamara ? (
          <Grupo
            titulo="Foto"
            pie="La de la cámara: se guarda con el producto y sirve para reconocerlo la próxima vez."
          >
            <View style={s.foto}>
              <Image source={{ uri: fotoCamara.uri }} style={s.fotoCamara} />
            </View>
          </Grupo>
        ) : null}

        <Grupo titulo="Dónde está">
          <CampoFila
            etiqueta="Lugar"
            placeholder="A1"
            value={ubicacion}
            onChangeText={setUbicacion}
            autoCapitalize="characters"
            editable={editable}
          />
        </Grupo>

        {/* En el contenido y no en el encabezado: en iOS 26 los botones del encabezado
            del modal perdían el primer toque con el teclado abierto. */}
        {editable ? (
          <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
            {existente ? "Guardar cambios" : "Agregar al inventario"}
          </BotonPrincipal>
        ) : null}

        {existente && (existente.foto_path || editable) ? (
          <Grupo
            titulo="Foto"
            pie={
              fotoError ??
              "Ayuda a reconocerlo de un vistazo. Solo la ven quienes tienen acceso al inventario."
            }
            pieError={!!fotoError}
          >
            {existente.foto_path ? (
              <View style={s.foto}>
                <FotoProducto
                  ruta={existente.foto_path}
                  tam={220}
                  version={existente.actualizado_en}
                />
              </View>
            ) : null}
            {editable ? (
              <Fila
                titulo={existente.foto_path ? "Cambiar foto" : "Tomar foto"}
                tinte
                onPress={() => router.push({ pathname: "/foto", params: { id: existente.id } })}
              />
            ) : null}
            {editable && existente.foto_path ? (
              <Fila
                titulo="Quitar foto"
                destructiva
                onPress={() =>
                  confirmar(
                    "¿Quitar la foto?",
                    "Se borra para todos los que tienen acceso.",
                    "Quitar",
                    () => {
                      setFotoError(null);
                      quitarFotoProducto(existente).catch((e: Error) => setFotoError(e.message));
                    },
                  )
                }
              />
            ) : null}
          </Grupo>
        ) : null}

        {existente ? (
          <Grupo>
            <Fila titulo="Última actualización" valor={haceCuanto(existente.actualizado_en)} />
            <Fila titulo="Origen" valor={existente.fuente === "camara" ? "Cámara" : "Manual"} />
          </Grupo>
        ) : null}

        {existente && editable ? (
          <Grupo>
            <Fila titulo="Eliminar producto" destructiva onPress={eliminar} />
          </Grupo>
        ) : null}

        {!editable ? (
          <Text style={[tipo.nota, { color: t.textoSec, textAlign: "center" }]}>
            Tenés acceso de solo lectura a este inventario.
          </Text>
        ) : null}
      </Contenido>
    </View>
  );
}

function Numero({ n, onCambio }: { n: number; onCambio: (n: number) => void }) {
  const t = useTema();
  return (
    <View style={s.numero}>
      <Text
        style={[
          tipo.cuerpo,
          { color: t.texto, fontVariant: ["tabular-nums"], minWidth: 28, textAlign: "right" },
        ]}
      >
        {n}
      </Text>
      <Stepper valor={n} onCambio={onCambio} />
    </View>
  );
}

const s = StyleSheet.create({
  foto: { alignItems: "center", paddingVertical: 16 },
  fotoCamara: { width: 160, height: 160, borderRadius: 160 * 0.22 },
  numero: { flexDirection: "row", alignItems: "center", gap: 12 },
});
