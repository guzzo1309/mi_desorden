import type { Producto } from "@mi-desorden/core";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FichaTecnica } from "@/components/FichaTecnica";
import { Numero } from "@/components/Stepper";
import { BotonCabecera, Contenido, Fila, Grupo, Icono } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { rutaCategoria } from "@/lib/categorias";
import { haceCuanto } from "@/lib/fecha";
import { useAcciones, useInventario } from "@/lib/store";
import { nombreLugar } from "@/lib/texto";
import { fuenteMarca, tipo, useTema } from "@/lib/theme";

/** Espera tras el último toque del stepper antes de guardar (así 5 toques son 1 pedido). */
const ESPERA_STOCK = 600;

/**
 * Modo ver del producto: lo que se abre al tocarlo. La cantidad se ajusta aquí
 * mismo con el stepper; todo lo demás se cambia con Editar (arriba a la derecha).
 */
export function VistaProducto({
  producto,
  onEditar,
}: {
  producto: Producto;
  onEditar: () => void;
}) {
  const t = useTema();
  const { categoriasActivas, permisos } = useInventario();
  const { ajustarStock } = useAcciones();
  const editable = permisos.editar_productos;
  const puedeAjustar = permisos.ajustar_stock;

  const [cantidad, setCantidad] = useState(producto.cantidad);
  const [errorStock, setErrorStock] = useState<string | null>(null);
  const pendiente = useRef<{ timer: ReturnType<typeof setTimeout>; n: number } | null>(null);

  // Si otro la cambia (realtime) y no hay un ajuste mío en espera, se muestra la nueva.
  useEffect(() => {
    if (!pendiente.current) setCantidad(producto.cantidad);
  }, [producto.cantidad]);

  const guardarCantidad = (n: number) => {
    pendiente.current = null;
    if (n === producto.cantidad) return;
    ajustarStock(producto.id, n).catch((e: Error) => {
      setErrorStock(e.message);
      setCantidad(producto.cantidad);
    });
  };

  // Al cerrar con un ajuste en espera, se guarda igual.
  const guardarRef = useRef(guardarCantidad);
  guardarRef.current = guardarCantidad;
  useEffect(
    () => () => {
      const p = pendiente.current;
      if (p) {
        clearTimeout(p.timer);
        guardarRef.current(p.n);
      }
    },
    [],
  );

  function cambiarCantidad(n: number) {
    setErrorStock(null);
    setCantidad(n);
    if (pendiente.current) clearTimeout(pendiente.current.timer);
    pendiente.current = { n, timer: setTimeout(() => guardarCantidad(n), ESPERA_STOCK) };
  }

  // Antes de pasar al formulario se guarda el ajuste en espera: si no, el formulario
  // arrancaría con la cantidad vieja y al guardar la pisaría.
  async function editar() {
    const p = pendiente.current;
    if (p) {
      clearTimeout(p.timer);
      pendiente.current = null;
      if (p.n !== producto.cantidad) {
        try {
          await ajustarStock(producto.id, p.n);
        } catch (e) {
          setErrorStock((e as Error).message);
          setCantidad(producto.cantidad);
          return;
        }
      }
    }
    onEditar();
  }

  const detalle = [
    rutaCategoria(categoriasActivas, producto.categoria_id),
    producto.ubicacion ? nombreLugar(producto.ubicacion) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const bajo = cantidad < producto.minimo;
  const revisar = producto.por_revisar && editable && permisos.gestionar_fotos;

  return (
    <>
      <Stack.Screen
        options={{
          title: "",
          headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
          headerRight: editable
            ? () => <BotonCabecera texto="Editar" onPress={editar} />
            : undefined,
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <View style={s.encabezado}>
          {producto.foto_path ? (
            <FotoProducto ruta={producto.foto_path} tam={96} />
          ) : (
            <View style={[s.sinFoto, { backgroundColor: t.relleno }]}>
              <Icono sf="shippingbox" ion="cube-outline" size={40} color={t.textoSec} />
            </View>
          )}
          <Text
            style={[tipo.titulo2, { color: t.texto, textAlign: "center" }]}
            accessibilityRole="header"
          >
            {producto.nombre}
          </Text>
          {detalle ? (
            <Text style={[tipo.nota, { color: t.textoSec, textAlign: "center" }]}>{detalle}</Text>
          ) : null}
        </View>

        {/* Nuevo de una factura: el owner lo termina con categoría y foto. */}
        {revisar ? (
          <Grupo
            titulo="Para revisar"
            pie="Entró con una factura. Asígnale la categoría y sube su foto: recién ahí deja de estar pendiente."
            sangria={52}
          >
            <Fila
              titulo="Categoría"
              izquierda={<Hecho listo={!!producto.categoria_id} />}
              valor={producto.categoria_id ? "Asignada" : undefined}
              tinte={!producto.categoria_id}
              chevron={!producto.categoria_id}
              onPress={producto.categoria_id ? undefined : editar}
            />
            <Fila
              titulo={producto.foto_path ? "Foto" : "Subir foto"}
              izquierda={<Hecho listo={!!producto.foto_path} />}
              valor={producto.foto_path ? "Subida" : undefined}
              tinte={!producto.foto_path}
              chevron={!producto.foto_path}
              onPress={
                producto.foto_path
                  ? undefined
                  : () => router.push({ pathname: "/foto", params: { id: producto.id } })
              }
            />
          </Grupo>
        ) : null}

        <Grupo
          pie={
            errorStock ??
            (bajo
              ? `Por reponer: hay menos que el mínimo (${producto.minimo}).`
              : `Mínimo ${producto.minimo}. Si baja de ahí, aparece en “Por reponer”.`)
          }
          pieError={!!errorStock}
        >
          <Fila
            titulo="En inventario"
            derecha={
              puedeAjustar ? (
                <Numero n={cantidad} onCambio={cambiarCantidad} />
              ) : (
                <Text
                  style={[
                    tipo.cuerpo,
                    { color: bajo ? t.tinte : t.textoSec, fontFamily: fuenteMarca },
                  ]}
                >
                  {cantidad}
                </Text>
              )
            }
          />
        </Grupo>

        <FichaTecnica producto={producto} />

        {/* Sin permiso para cambiar nada: se lo pide al owner o a un editor. */}
        {!editable && !puedeAjustar ? (
          <Grupo titulo="Pedir cambios" pie="Le llega al owner y a los editores del inventario.">
            <Fila
              titulo="Pedir otra cantidad"
              tinte
              chevron
              onPress={() =>
                router.push({
                  pathname: "/solicitud",
                  params: { tipo: "stock", producto: producto.id },
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
                  params: { tipo: "eliminar", producto: producto.id },
                })
              }
            />
          </Grupo>
        ) : null}

        <Text style={[tipo.nota, { color: t.textoTer, textAlign: "center" }]}>
          Actualizado {haceCuanto(producto.actualizado_en)} ·{" "}
          {producto.fuente === "camara" ? "cargado con la cámara" : "cargado a mano"}
        </Text>
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

const s = StyleSheet.create({
  encabezado: { alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  sinFoto: {
    width: 96,
    height: 96,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
