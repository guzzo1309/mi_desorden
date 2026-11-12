import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import type { Producto } from "@mi-desorden/core";
import { mensajeError } from "@/api";
import { DescripcionIA } from "@/components/DescripcionIA";
import { EditorFicha } from "@/components/EditorFicha";
import { MenuCategoria } from "@/components/menus";
import { Numero } from "@/components/Stepper";
import { FotosProducto, type FotoSlot } from "@/components/FotosProducto";
import { VistaProducto } from "@/components/VistaProducto";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  FilaEtiqueta,
  Grupo,
  Vacio,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { errorFicha, fichaCambio, fichaDe, limpiarFicha } from "@/lib/ficha";
import { useAcciones, useInventario } from "@/lib/store";
import { fotoPendiente, type Foto } from "@/lib/fotoPendiente";
import { FOTOS_IDEALES, FOTOS_RECOMENDADAS, MAX_FOTOS, rutasDe, textoFotos } from "@/lib/fotos";
import { tipo, useTema } from "@/lib/theme";

/**
 * Un producto en una sola pantalla, como Contactos: se abre en modo ver (cantidad
 * con stepper, descripción y ficha) y Editar la pasa a formulario sin abrir otra hoja.
 * Un producto nuevo arranca directo en el formulario.
 */
export default function PantallaProducto() {
  // editar=1: abrir directo en el formulario (p. ej. uno sin categoría).
  const params = useLocalSearchParams<{ id?: string; editar?: string }>();
  const { productosActivos, permisos } = useInventario();
  const existente = params.id ? productosActivos.find((p) => p.id === params.id) : undefined;
  const [editando, setEditando] = useState(
    !params.id || (params.editar === "1" && permisos.editar_productos),
  );

  if (params.id && !existente) {
    return (
      <>
        <Stack.Screen
          options={{
            title: "Producto",
            headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
            headerRight: undefined,
          }}
        />
        <Contenido>
          <Vacio
            sf="shippingbox"
            ion="cube-outline"
            titulo="Producto no encontrado"
            texto="Puede que lo hayan eliminado del inventario."
          />
        </Contenido>
      </>
    );
  }
  if (existente && !editando) {
    return <VistaProducto producto={existente} onEditar={() => setEditando(true)} />;
  }
  return (
    <FormularioProducto
      existente={existente}
      onTerminar={existente ? () => setEditando(false) : () => router.back()}
    />
  );
}

function FormularioProducto({
  existente,
  onTerminar,
}: {
  existente: Producto | undefined;
  onTerminar: () => void;
}) {
  // categoria: preelegida al crear desde una carpeta.
  // nombre + desdeCamara: la cámara no lo reconoció y propone agregarlo con su foto.
  const params = useLocalSearchParams<{
    categoria?: string;
    nombre?: string;
    desdeCamara?: string;
  }>();
  const t = useTema();
  const { categoriasActivas, permisos, activo } = useInventario();
  const {
    guardarProducto,
    guardarFicha,
    eliminarProducto,
    quitarFotoProducto,
    subirFotoProducto,
    agregarFotoExtra,
  } = useAcciones();
  const editable = permisos.editar_productos;
  const fotos = permisos.gestionar_fotos;
  const fichaOriginal = fichaDe(existente ?? {});
  const [ficha, setFicha] = useState(fichaOriginal);

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
  const [descripcion, setDescripcion] = useState(existente?.descripcion ?? "");
  const [fotoError, setFotoError] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido =
    editable &&
    nombre.trim().length > 0 &&
    ubicacion.trim().length > 0 &&
    categoriaValida &&
    !guardando;

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
        // Solo si cambió: así guardar no toca la columna si nadie la usó.
        ...(descripcion.trim() !== (existente?.descripcion ?? "")
          ? { descripcion: descripcion.trim() }
          : {}),
      });
      if (fichaCambio(fichaOriginal, ficha)) {
        try {
          await guardarFicha(guardado.id, limpiarFicha(ficha));
        } catch (e) {
          // El producto ya quedó guardado: solo falló la ficha. Se queda en el formulario.
          setError(errorFicha(mensajeError(e)));
          setGuardando(false);
          return;
        }
      }
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
      onTerminar();
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

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Editar producto" : "Nuevo producto",
          headerLeft: () => <BotonCabecera texto="Cancelar" onPress={onTerminar} />,
          headerRight: undefined,
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {fotosVisibles ? (
          <Grupo
            titulo={`Fotos · ${textoFotos(slots.length)}`}
            pie={
              fotoError ??
              (fotos ? consejoFotos(slots.length) : "Las fotos las saca el owner del inventario.")
            }
            pieError={!!fotoError}
          >
            <FotosProducto
              fotos={slots}
              onAgregar={fotos && slots.length < MAX_FOTOS ? agregarFoto : undefined}
              onQuitar={fotos ? quitarFoto : undefined}
            />
          </Grupo>
        ) : null}

        <Grupo
          titulo="Datos básicos"
          pie={error ?? "Nombre, categoría y lugar son obligatorios."}
          pieError={!!error}
        >
          <CampoFila
            etiqueta="Nombre"
            placeholder="Ej. Mouse inalámbrico"
            value={nombre}
            onChangeText={setNombre}
            editable={editable}
            autoFocus={!existente}
          />
          <FilaEtiqueta etiqueta="Categoría">
            <MenuCategoria
              categorias={categoriasActivas}
              valor={categoriaValida ? categoriaId : null}
              onCambio={setCategoriaId}
              onNueva={() => router.push("/categoria")}
              editable={editable}
            />
          </FilaEtiqueta>
          <CampoFila
            etiqueta="Lugar"
            placeholder="Ej. Estante A1"
            value={ubicacion}
            onChangeText={setUbicacion}
            autoCapitalize="characters"
            editable={editable}
          />
        </Grupo>

        <Grupo titulo="Stock" pie="Si la cantidad baja del mínimo, aparece en “Por reponer”.">
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

        {activo && (existente || editable) ? (
          <DescripcionIA
            valor={descripcion}
            onCambio={setDescripcion}
            editable={editable}
            puedeIa={permisos.usar_ia}
            inventarioId={existente?.inventario_id ?? activo.id}
            productoId={existente?.id ?? null}
            nombre={nombre}
            categoria={categoriasActivas.find((c) => c.id === categoriaId)?.nombre ?? null}
            categorias={categoriasActivas.map((c) => c.nombre)}
            onCategoriaSugerida={(nombreCategoria) => {
              const c = categoriasActivas.find((x) => x.nombre === nombreCategoria);
              if (c) setCategoriaId(c.id);
            }}
          />
        ) : null}

        {editable ? <EditorFicha valor={ficha} onCambio={setFicha} /> : null}

        {/* En el contenido y no en el encabezado: en iOS 26 los botones del encabezado
            del modal perdían el primer toque con el teclado abierto. */}
        {editable ? (
          <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
            {existente ? "Guardar cambios" : "Agregar al inventario"}
          </BotonPrincipal>
        ) : null}

        {existente && editable ? (
          <Grupo>
            <Fila titulo="Eliminar producto" destructiva onPress={eliminar} />
          </Grupo>
        ) : null}
      </Contenido>
    </>
  );
}

/**
 * Consejo según cuántas fotos tiene. La cámara compara contra cada foto y se queda
 * con la más parecida: ángulos distintos cubren más formas de verlo.
 */
function consejoFotos(n: number): string {
  if (n === 0) return "Sube 2 o 3 fotos desde ángulos distintos para que la cámara lo reconozca.";
  if (n < FOTOS_RECOMENDADAS)
    return "Agrega 1 o 2 más desde otros ángulos: con una sola se confunde más.";
  if (n < FOTOS_IDEALES)
    return "Bien. Una más con otra luz o de otro lado ayuda si tienes productos parecidos.";
  if (n < MAX_FOTOS)
    return "Listo: con 3 desde ángulos distintos ya lo reconoce bien. Suma más solo si se confunde con otro parecido.";
  return `Llegaste al máximo de ${MAX_FOTOS} fotos. Quita una para sumar otra.`;
}
