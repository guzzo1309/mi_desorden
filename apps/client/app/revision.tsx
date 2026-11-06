import type { Producto } from "@mi-desorden/core";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { FotosProducto, type FotoSlot } from "@/components/FotosProducto";
import { MenuCategoria } from "@/components/menus";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
  Vacio,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { FOTOS_RECOMENDADAS, MAX_FOTOS, rutasDe, textoFotos } from "@/lib/fotos";
import { useAcciones, useInventario } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/**
 * Completar uno por uno los productos que entraron con una factura: categoría,
 * lugar y 2 o 3 fotos de cada uno. Sin fotos la cámara solo los reconoce por la
 * etiqueta; con ellas, también por cómo se ven.
 */
export default function Revision() {
  const t = useTema();
  const { porRevisar } = useInventario();
  // La cola se fija al abrir: al completar uno, los demás no cambian de lugar.
  const [ids] = useState(() => porRevisar.map((p) => p.id));
  const [indice, setIndice] = useState(0);
  const [completos, setCompletos] = useState(0);

  const terminado = indice >= ids.length;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Completar productos",
          headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {!ids.length ? (
          <Vacio
            sf="checkmark.circle"
            ion="checkmark-circle-outline"
            titulo="No hay productos por completar"
            texto="Cuando cargues una factura con productos nuevos, aquí los completas uno por uno."
          />
        ) : terminado ? (
          <>
            <View style={s.centro}>
              <Icono sf="checkmark.circle.fill" ion="checkmark-circle" size={48} color={t.verde} />
              <Text style={[tipo.titulo2, { color: t.texto }]}>¡Listo!</Text>
              <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center" }]}>
                {completos === ids.length
                  ? `Completaste los ${ids.length} productos.`
                  : `Completaste ${completos} de ${ids.length}. Los que faltan te siguen apareciendo en el inventario.`}
              </Text>
            </View>
            <BotonPrincipal onPress={() => router.back()}>Volver al inventario</BotonPrincipal>
          </>
        ) : (
          <Paso
            key={ids[indice]}
            id={ids[indice]!}
            posicion={indice + 1}
            total={ids.length}
            onSiguiente={(guardado) => {
              if (guardado) setCompletos((c) => c + 1);
              setIndice((i) => i + 1);
            }}
          />
        )}
      </Contenido>
    </>
  );
}

function Paso({
  id,
  posicion,
  total,
  onSiguiente,
}: {
  id: string;
  posicion: number;
  total: number;
  onSiguiente: (guardado: boolean) => void;
}) {
  const t = useTema();
  const { productosActivos, categoriasActivas } = useInventario();
  const { guardarProducto, quitarFotoProducto } = useAcciones();
  // Siempre el producto como está ahora: las fotos que se suman aparecen solas.
  const producto = productosActivos.find((p) => p.id === id) as Producto | undefined;

  const [nombre, setNombre] = useState(producto?.nombre ?? "");
  const [categoriaId, setCategoriaId] = useState<string | null>(producto?.categoria_id ?? null);
  const [ubicacion, setUbicacion] = useState(producto?.ubicacion ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!producto) return null;

  const categoriaValida = !!categoriaId && categoriasActivas.some((c) => c.id === categoriaId);
  const slots: FotoSlot[] = rutasDe(producto).map((ruta) => ({ clave: ruta, ruta }));
  const valido = nombre.trim().length > 0 && ubicacion.trim().length > 0 && categoriaValida;

  async function guardar() {
    if (!valido || guardando || !producto) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarProducto(producto.id, {
        nombre: nombre.trim(),
        categoria_id: categoriaId,
        cantidad: producto.cantidad,
        minimo: producto.minimo,
        ubicacion: ubicacion.trim().toUpperCase(),
      });
      onSiguiente(true);
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  return (
    <>
      <View style={s.progreso}>
        <Text style={[tipo.nota, { color: t.textoSec }]}>
          Producto {posicion} de {total}
        </Text>
        <View style={[s.pista, { backgroundColor: t.relleno }]}>
          <View
            style={[
              s.relleno,
              { backgroundColor: t.tinte, width: `${((posicion - 1) / total) * 100}%` },
            ]}
          />
        </View>
      </View>

      <Grupo
        pie={
          error ??
          `Entraron ${producto.cantidad} ${producto.cantidad === 1 ? "unidad" : "unidades"} con la factura.`
        }
        pieError={!!error}
      >
        <CampoFila placeholder="Nombre" value={nombre} onChangeText={setNombre} />
        <Fila
          titulo="Categoría"
          derecha={
            <MenuCategoria
              categorias={categoriasActivas}
              valor={categoriaValida ? categoriaId : null}
              onCambio={setCategoriaId}
              onNueva={() => router.push("/categoria")}
            />
          }
        />
        <CampoFila
          etiqueta="Lugar"
          placeholder="A1"
          value={ubicacion}
          onChangeText={setUbicacion}
          autoCapitalize="characters"
        />
      </Grupo>

      <Grupo
        titulo={`Fotos para reconocerlo · ${textoFotos(slots.length)}`}
        pie={
          slots.length < FOTOS_RECOMENDADAS
            ? "Sube 2 o 3 fotos desde distintos ángulos: así la cámara lo reconoce por cómo se ve, no solo por la etiqueta."
            : "Con varias fotos la cámara lo reconoce mejor."
        }
      >
        <FotosProducto
          fotos={slots}
          onAgregar={
            slots.length < MAX_FOTOS
              ? () => router.push({ pathname: "/foto", params: { id: producto.id } })
              : undefined
          }
          onQuitar={(f) =>
            confirmar(
              "¿Quitar esta foto?",
              "Se borra y el modelo deja de usarla para reconocer el producto.",
              "Quitar",
              () => void quitarFotoProducto(producto, f.ruta!).catch(() => {}),
            )
          }
        />
      </Grupo>

      <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
        {posicion === total ? "Guardar y terminar" : "Guardar y seguir"}
      </BotonPrincipal>
      <BotonPrincipal variante="gris" deshabilitado={guardando} onPress={() => onSiguiente(false)}>
        {posicion === total ? "Terminar sin guardar este" : "Saltar este por ahora"}
      </BotonPrincipal>
    </>
  );
}

const s = StyleSheet.create({
  centro: { alignItems: "center", gap: 10, paddingVertical: 24 },
  progreso: { gap: 8, paddingHorizontal: 4 },
  pista: { height: 6, borderRadius: 3, overflow: "hidden" },
  relleno: { height: 6, borderRadius: 3 },
});
