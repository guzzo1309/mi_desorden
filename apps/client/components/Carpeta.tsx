import type { Producto } from "@mi-desorden/core";
import { router } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { FilaProducto, SANGRIA_FILA } from "@/components/FilaProducto";
import { MenuPuntos, type Accion } from "@/components/menus";
import { Icono, tocar } from "@/components/ui";
import { Separador, Tarjeta } from "@/components/vistas";
import type { NodoCategoria } from "@/lib/categorias";
import { confirmar } from "@/lib/confirmar";
import { useAcciones } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/** Las líneas entre productos arrancan donde empieza el texto (después de la foto). */
const SANGRIA_PRODUCTO = SANGRIA_FILA;

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Una categoría principal como tarjeta desplegable: adentro sus subcategorías
 * (también desplegables), sus productos y "Nuevo producto".
 */
export function Carpeta({
  nodo,
  abiertas,
  alternar,
  editable,
}: {
  nodo: NodoCategoria;
  abiertas: Set<string>;
  alternar: (id: string) => void;
  editable: boolean;
}) {
  return (
    <Tarjeta>
      <Contenido
        nodo={nodo}
        nivel={0}
        abiertas={abiertas}
        alternar={alternar}
        editable={editable}
      />
    </Tarjeta>
  );
}

function Contenido({
  nodo,
  nivel,
  abiertas,
  alternar,
  editable,
}: {
  nodo: NodoCategoria;
  nivel: 0 | 1;
  abiertas: Set<string>;
  alternar: (id: string) => void;
  editable: boolean;
}) {
  const abierta = abiertas.has(nodo.categoria.id);
  const vacia = !nodo.hijas.length && !nodo.productos.length;
  return (
    <>
      <Cabecera
        nodo={nodo}
        nivel={nivel}
        abierta={abierta}
        onPress={() => alternar(nodo.categoria.id)}
        editable={editable}
      />
      {abierta ? (
        <>
          {nodo.hijas.map((h) => (
            <View key={h.categoria.id}>
              <Separador sangria={16} />
              <Contenido
                nodo={h}
                nivel={1}
                abiertas={abiertas}
                alternar={alternar}
                editable={editable}
              />
            </View>
          ))}
          {nodo.productos.map((p) => (
            <View key={p.id} style={nivel ? s.sangriaSub : undefined}>
              <Separador sangria={SANGRIA_PRODUCTO} />
              <FilaProducto producto={p} onPress={() => abrirProducto(p)} />
            </View>
          ))}
          {editable ? (
            <View style={nivel ? s.sangriaSub : undefined}>
              <Separador sangria={SANGRIA_PRODUCTO} />
              <NuevoProducto categoriaId={nodo.categoria.id} />
            </View>
          ) : vacia ? (
            <View style={nivel ? s.sangriaSub : undefined}>
              <Separador sangria={SANGRIA_PRODUCTO} />
              <TextoVacio />
            </View>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const abrirProducto = (p: Producto) => router.push({ pathname: "/producto", params: { id: p.id } });

function Cabecera({
  nodo,
  nivel,
  abierta,
  onPress,
  editable,
}: {
  nodo: NodoCategoria;
  nivel: 0 | 1;
  abierta: boolean;
  onPress: () => void;
  editable: boolean;
}) {
  const t = useTema();
  const { categoria, hijas, total } = nodo;
  const detalle =
    plural(total, "producto", "productos") +
    (hijas.length ? ` · ${plural(hijas.length, "subcategoría", "subcategorías")}` : "");
  const acciones = useAccionesCarpeta(nodo, nivel);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: abierta }}
      accessibilityHint={abierta ? "Cierra la categoría" : "Muestra los productos"}
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => [
        s.cabecera,
        nivel ? s.sangriaSub : undefined,
        pressed && { backgroundColor: t.relleno },
      ]}
    >
      <Icono
        sf={abierta ? "folder.fill" : "folder"}
        ion={abierta ? "folder-open" : "folder-outline"}
        size={nivel ? 20 : 22}
        color={nivel ? t.textoSec : t.tinte}
      />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          style={[tipo.cuerpo, { color: t.texto, fontWeight: nivel ? "500" : "600" }]}
          numberOfLines={1}
        >
          {categoria.nombre}
        </Text>
        <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
          {detalle}
        </Text>
      </View>
      {editable ? <MenuPuntos titulo={categoria.nombre} grupos={acciones} /> : null}
      <View style={{ transform: [{ rotate: abierta ? "90deg" : "0deg" }] }}>
        <Icono
          sf="chevron.right"
          ion="chevron-forward"
          size={13}
          color={t.textoTer}
          weight="semibold"
        />
      </View>
    </Pressable>
  );
}

/** Lo del "•••": nuevo producto, subcategoría (solo en principales), renombrar, eliminar. */
function useAccionesCarpeta(nodo: NodoCategoria, nivel: 0 | 1): Accion[][] {
  const { eliminarCategoria } = useAcciones();
  const { categoria, hijas, productos } = nodo;

  function eliminar() {
    if (hijas.length || productos.length) {
      Alert.alert(
        `“${categoria.nombre}” no está vacía`,
        hijas.length
          ? "Primero elimina sus subcategorías."
          : "Primero mueve sus productos a otra categoría o eliminalos.",
      );
      return;
    }
    confirmar(`¿Eliminar “${categoria.nombre}”?`, "La categoría está vacía.", "Eliminar", () =>
      eliminarCategoria(categoria.id).catch((e: Error) =>
        Alert.alert("No se pudo eliminar", e.message),
      ),
    );
  }

  return [
    [
      {
        etiqueta: "Nuevo producto",
        sf: "plus",
        onPress: () => router.push({ pathname: "/producto", params: { categoria: categoria.id } }),
      },
      ...(nivel === 0
        ? [
            {
              etiqueta: "Nueva subcategoría",
              sf: "folder.badge.plus" as const,
              onPress: () =>
                router.push({ pathname: "/categoria", params: { padre: categoria.id } }),
            },
          ]
        : []),
    ],
    [
      {
        etiqueta: "Renombrar",
        sf: "pencil",
        onPress: () => router.push({ pathname: "/categoria", params: { id: categoria.id } }),
      },
    ],
    [{ etiqueta: "Eliminar", sf: "trash", destructiva: true, onPress: eliminar }],
  ];
}

function NuevoProducto({ categoriaId }: { categoriaId: string }) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (
        tocar(),
        router.push({ pathname: "/producto", params: { categoria: categoriaId } })
      )}
      style={({ pressed }) => [s.nuevo, pressed && { backgroundColor: t.relleno }]}
    >
      <Icono sf="plus.circle.fill" ion="add-circle" size={20} color={t.tinte} />
      <Text style={[tipo.cuerpo, { color: t.tinte }]}>Nuevo producto</Text>
    </Pressable>
  );
}

function TextoVacio() {
  const t = useTema();
  return (
    <Text style={[tipo.nota, s.vacio, { color: t.textoSec }]}>Todavía no hay productos aquí.</Text>
  );
}

const s = StyleSheet.create({
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 60,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 8,
  },
  sangriaSub: { paddingLeft: 20 },
  nuevo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingLeft: 12,
    paddingRight: 14,
  },
  vacio: { paddingLeft: SANGRIA_PRODUCTO, paddingVertical: 14 },
});
