import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MenuCategoria } from "@/components/menus";
import { Stepper } from "@/components/Stepper";
import { FotosProducto, type FotoSlot } from "@/components/FotosProducto";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { haceCuanto } from "@/lib/fecha";
import { useAcciones, useInventario } from "@/lib/store";
import { fotoPendiente, type Foto } from "@/lib/fotoPendiente";
import { FOTOS_RECOMENDADAS, MAX_FOTOS, rutasDe, textoFotos } from "@/lib/fotos";
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
  const { productosActivos, categoriasActivas, permisos } = useInventario();
  const {
    guardarProducto,
    eliminarProducto,
    quitarFotoProducto,
    subirFotoProducto,
    agregarFotoExtra,
    ajustarStock,
  } = useAcciones();
  const existente = id ? productosActivos.find((p) => p.id === id) : undefined;
  const editable = permisos.editar_productos;
  const fotos = permisos.gestionar_fotos;
  // Employee: en un producto existente solo cambia la cantidad.
  const soloStock = !!existente && !editable && permisos.ajustar_stock;

  const [nombre, setNombre] = useState(existente?.nombre ?? params.nombre ?? "");
  // Fotos de un producto que todavía no se guardó: la que sacó la cámara y las del formulario.
  const [fotosNuevas, setFotosNuevas] = useState<Foto[]>(() =>
    !existente && params.desdeCamara === "1" && fotos ? fotoPendiente.lista() : [],
  );
  // Un formulario nuevo que no viene de la cámara arranca sin fotos de antes.
  useEffect(() => {
    if (!existente && params.desdeCamara !== "1") fotoPendiente.descartar();
  }, [existente, params.desdeCamara]);
  // Al volver de sacar una foto, se muestran las pendientes.
  useFocusEffect(
    useCallback(() => {
      if (!existente) setFotosNuevas(fotoPendiente.lista());
    }, [existente]),
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
      // Producto nuevo con fotos: la primera es la principal y las otras ayudan a reconocerlo.
      let actual = guardado;
      if (!existente) {
        for (const [i, f] of fotosNuevas.entries()) {
          try {
            actual =
              i === 0
                ? await subirFotoProducto(actual, f.base64)
                : await agregarFotoExtra(actual, f.base64);
          } catch {
            // Si una no sube, el producto igual quedó guardado: se puede sumar desde su ficha.
          }
        }
        fotoPendiente.descartar();
      }
      // Revisando uno nuevo de una factura: sin foto todavía, sigue directo a sacarla.
      if (actual.por_revisar && fotos && !actual.foto_path) {
        router.replace({ pathname: "/foto", params: { id: actual.id } });
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

  // Las fotos que se ven: las del producto, o las que se sacaron para uno nuevo.
  const slots: FotoSlot[] = existente
    ? rutasDe(existente).map((ruta) => ({ clave: ruta, ruta }))
    : fotosNuevas.map((f, i) => ({ clave: `nueva-${i}`, uri: f.uri }));
  // Un producto nuevo solo muestra la sección a quien puede sacar fotos.
  const fotosVisibles = existente ? fotos || slots.length > 0 : fotos;

  function agregarFoto() {
    setFotoError(null);
    router.push(
      existente
        ? { pathname: "/foto", params: { id: existente.id } }
        : { pathname: "/foto", params: { nuevo: "1" } },
    );
  }

  function quitarFoto(foto: FotoSlot) {
    if (!existente) {
      const indice = slots.findIndex((f) => f.clave === foto.clave);
      fotoPendiente.quitar(indice);
      setFotosNuevas(fotoPendiente.lista());
      return;
    }
    confirmar(
      "¿Quitar esta foto?",
      "Se borra para todos los que tienen acceso y el modelo deja de usarla para reconocer el producto.",
      "Quitar",
      () => {
        setFotoError(null);
        quitarFotoProducto(existente, foto.ruta!).catch((e: Error) => setFotoError(e.message));
      },
    );
  }

  const textoHeader = (texto: string, onPress: () => void, fuerte?: boolean, apagado?: boolean) => (
    <BotonCabecera texto={texto} onPress={onPress} fuerte={fuerte} apagado={apagado} />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Producto" : "Nuevo producto",
          headerLeft: () => textoHeader(editable ? "Cancelar" : "Cerrar", () => router.back()),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {/* Nuevo de una factura: el owner lo termina con categoría y foto. */}
        {existente?.por_revisar && editable && fotos ? (
          <Grupo
            titulo="Para revisar"
            pie="Entró con una factura. Asígnale la categoría, guarda y sube su foto: recién ahí deja de estar pendiente."
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

        {fotosVisibles ? (
          <Grupo
            titulo={`Fotos para reconocerlo · ${textoFotos(slots.length)}`}
            pie={
              fotoError ??
              (fotos
                ? slots.length < FOTOS_RECOMENDADAS
                  ? "Sube 2 o 3 fotos desde distintos ángulos: así el modelo lo reconoce mejor. Solo las ven quienes tienen acceso al inventario."
                  : "Con varias fotos el modelo reconoce mejor el producto. Solo las ven quienes tienen acceso al inventario."
                : "Las fotos las saca el owner del inventario.")
            }
            pieError={!!fotoError}
          >
            <FotosProducto
              fotos={slots}
              version={existente?.actualizado_en}
              onAgregar={fotos && slots.length < MAX_FOTOS ? agregarFoto : undefined}
              onQuitar={fotos ? quitarFoto : undefined}
            />
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

        {/* El lector no edita: le pide los cambios al owner o a un editor. */}
        {existente && !editable && !soloStock ? (
          <Grupo titulo="Pedir cambios" pie="Le llega al owner y a los editores del inventario.">
            <Fila
              titulo="Pedir otra cantidad"
              tinte
              chevron
              onPress={() =>
                router.push({
                  pathname: "/solicitud",
                  params: { tipo: "stock", producto: existente.id },
                })
              }
            />
            <Fila
              titulo="Pedir que lo eliminen"
              destructiva
              chevron
              onPress={() =>
                router.push({
                  pathname: "/solicitud",
                  params: { tipo: "eliminar", producto: existente.id },
                })
              }
            />
          </Grupo>
        ) : null}

        {!editable ? (
          <Text style={[tipo.nota, { color: t.textoSec, textAlign: "center" }]}>
            {soloStock
              ? "Tu rol solo ajusta la cantidad. Para cambiar el resto, pídeselo al owner."
              : "Tienes acceso de solo lectura a este inventario."}
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
  numero: { flexDirection: "row", alignItems: "center", gap: 12 },
});
