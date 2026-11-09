import { router, Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { FichaTecnica } from "@/components/FichaTecnica";
import { BotonCabecera, Contenido, Fila, Grupo, Icono, Vacio } from "@/components/ui";
import { FotoProducto } from "@/components/vistas";
import { rutaCategoria } from "@/lib/categorias";
import { useInventario } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/**
 * Ficha técnica de un producto: se abre al tocarlo en el inventario o desde
 * la cámara. La ven todos los roles; solo owner y editores la editan.
 */
export default function Ficha() {
  const t = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { productosActivos, categoriasActivas, permisos } = useInventario();
  const producto = productosActivos.find((p) => p.id === id);

  const cabecera = (
    <Stack.Screen
      options={{
        title: "Ficha técnica",
        headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
      }}
    />
  );

  if (!producto) {
    return (
      <>
        {cabecera}
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

  const detalle = [rutaCategoria(categoriasActivas, producto.categoria_id), producto.ubicacion]
    .filter(Boolean)
    .join(" · ");
  const bajo = producto.cantidad < producto.minimo;
  const abrirProducto = () => router.push({ pathname: "/producto", params: { id: producto.id } });
  const editarFicha = () => router.push({ pathname: "/ficha-editar", params: { id: producto.id } });

  return (
    <>
      {cabecera}
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
          <Text style={[tipo.titulo2, { color: t.texto, textAlign: "center" }]}>
            {producto.nombre}
          </Text>
          {detalle ? (
            <Text style={[tipo.nota, { color: t.textoSec, textAlign: "center" }]}>{detalle}</Text>
          ) : null}
        </View>

        <Grupo>
          <Fila
            titulo="En inventario"
            valor={`${producto.cantidad}${bajo ? " · por reponer" : ""}`}
          />
        </Grupo>

        <FichaTecnica
          producto={producto}
          puedeEditar={permisos.editar_productos}
          onEditar={editarFicha}
        />

        <Grupo>
          <Fila
            titulo={
              permisos.editar_productos
                ? "Editar producto"
                : permisos.ajustar_stock
                  ? "Ajustar cantidad"
                  : "Stock y pedidos de cambio"
            }
            tinte
            chevron
            onPress={abrirProducto}
          />
        </Grupo>
      </Contenido>
    </>
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