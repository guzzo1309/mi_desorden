import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { MenuCategoria } from "@/components/menus";
import { Stepper } from "@/components/Stepper";
import { FotoProducto } from "@/components/vistas";
import { BotonPrincipal, CampoFila, Contenido, Fila, Grupo, Icono } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { haceCuanto } from "@/lib/fecha";
import { useStore } from "@/lib/store";
import { fotoPendiente } from "@/lib/fotoPendiente";
import { tipo, useTema } from "@/lib/theme";

export default function ProductoForm() {
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
    ajustarStock,
    permisos,
  } = useStore();
  const existente = id ? productosActivos.find((p) => p.id === id) : undefined;
  const editable = permisos.editar_productos;
  const fotos = permisos.gestionar_fotos;
  // Employee: en un producto existente solo cambia la cantidad.
  const soloStock = !!existente && !editable && permisos.ajustar_stock;

  const [nombre, setNombre] = useState(existente?.nombre ?? params.nombre ?? "");
  // La foto que sacó la cámara (solo al crear desde ahí).
  const [fotoCamara] = useState(() =>
    !existente && params.desdeCamara === "1" && fotos ? fotoPendiente.ver() : null,
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
  const valido = soloStock
    ? !guardando && cantidad !== existente!.cantidad
    : nombre.trim().length > 0 && ubicacion.trim().length > 0 && categoriaValida && !guardando;

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      if (soloStock) {
        await ajustarStock(existente!.id, cantidad);
        router.back();
        return;
      }
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
      // Revisando uno nuevo de una factura: sin foto todavía, sigue directo a sacarla.
      if (guardado.por_revisar && fotos && !guardado.foto_path) {
        router.replace({ pathname: "/foto", params: { id: guardado.id } });
        return;
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
    <>
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
        {/* Nuevo de una factura: un admin lo termina con categoría y foto. */}
        {existente?.por_revisar && editable && fotos ? (
          <Grupo
            titulo="Para revisar"
            pie="Entró con una factura. Asignale la categoría, guardá y subí su foto: recién ahí deja de estar pendiente."
            sangria={52}
          >
            <Fila
              titulo="Categoría"
              izquierda={<Hecho listo={!!existente.categoria_id} />}
              valor={existente.categoria_id ? "Asignada" : "Falta"}
            />
            <Fila
              titulo={existente.foto_path ? "Foto" : "Subir foto"}
              izquierda={<Hecho listo={!!existente.foto_path} />}
              valor={existente.foto_path ? "Subida" : undefined}
              tinte={!existente.foto_path}
              chevron={!existente.foto_path}
              onPress={
                existente.foto_path
                  ? undefined
                  : () => router.push({ pathname: "/foto", params: { id: existente.id } })
              }
            />
          </Grupo>
        ) : null}

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
              editable || soloStock ? (
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
        {editable || soloStock ? (
          <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
            {soloStock
              ? "Guardar cantidad"
              : existente
                ? "Guardar cambios"
                : "Agregar al inventario"}
          </BotonPrincipal>
        ) : null}

        {existente && (existente.foto_path || fotos) ? (
          <Grupo
            titulo="Foto"
            pie={
              fotoError ??
              (fotos
                ? "Ayuda a reconocerlo de un vistazo. Solo la ven quienes tienen acceso al inventario."
                : "Las fotos las sacan el owner y los admins del inventario.")
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
            {fotos ? (
              <Fila
                titulo={existente.foto_path ? "Cambiar foto" : "Tomar foto"}
                tinte
                onPress={() => router.push({ pathname: "/foto", params: { id: existente.id } })}
              />
            ) : null}
            {fotos && existente.foto_path ? (
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
            {soloStock
              ? "Tu rol solo ajusta la cantidad. Para cambiar el resto, pedíselo a un admin."
              : "Tenés acceso de solo lectura a este inventario."}
          </Text>
        ) : null}
      </Contenido>
    </>
  );
}

/** Tilde verde si ya está, círculo vacío si falta. */
function Hecho({ listo }: { listo: boolean }) {
  const t = useTema();
  return listo ? (
    <Icono sf="checkmark.circle.fill" ion="checkmark-circle" size={22} color={t.verde} />
  ) : (
    <Icono sf="circle" ion="ellipse-outline" size={22} color={t.textoTer} />
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
