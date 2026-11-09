import type { Especificacion } from "@mi-desorden/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { mensajeError } from "@/api";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
  tocar,
  Vacio,
} from "@/components/ui";
import {
  errorFicha,
  FICHA_LIMITES,
  fichaCambio,
  fichaDe,
  filasParaEditar,
  limpiarFicha,
} from "@/lib/ficha";
import { useAcciones, useInventario } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

/**
 * Formulario de la ficha técnica. Solo owner y editores (editar_productos):
 * la app no muestra el formulario a los demás y la base también lo bloquea
 * (trigger proteger_producto). La descripción se edita aparte, en producto.
 */
export default function FichaEditar() {
  const t = useTema();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { productosActivos, permisos } = useInventario();
  const { guardarFicha } = useAcciones();
  const producto = productosActivos.find((p) => p.id === id);
  const original = fichaDe(producto ?? {});

  const [marca, setMarca] = useState(original.marca);
  const [codigo, setCodigo] = useState(original.codigo);
  const [filas, setFilas] = useState<Especificacion[]>(() => filasParaEditar(original));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actual = { marca, codigo, especificaciones: filas };
  const cambio = fichaCambio(original, actual);

  const cabecera = (
    <Stack.Screen
      options={{
        title: "Editar ficha",
        headerLeft: () => <BotonCabecera texto="Cancelar" onPress={() => router.back()} />,
      }}
    />
  );

  if (!producto || !permisos.editar_productos) {
    return (
      <>
        {cabecera}
        <Contenido>
          <Vacio
            sf="lock"
            ion="lock-closed-outline"
            titulo={producto ? "Solo un administrador edita la ficha" : "Producto no encontrado"}
            texto={
              producto
                ? "El owner o un editor del inventario pueden cambiar la ficha técnica."
                : "Puede que lo hayan eliminado del inventario."
            }
          />
        </Contenido>
      </>
    );
  }

  function cambiarFila(i: number, cambios: Partial<Especificacion>) {
    setFilas((l) => l.map((f, j) => (j === i ? { ...f, ...cambios } : f)));
  }

  async function guardar() {
    if (!cambio || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarFicha(producto!.id, limpiarFicha(actual));
      router.back();
    } catch (e) {
      setError(errorFicha(mensajeError(e)));
      setGuardando(false);
    }
  }

  const estiloInput = [
    tipo.cuerpo,
    { color: t.texto, paddingVertical: 0 },
    Platform.OS === "web" && ({ outlineStyle: "none" } as object),
  ];

  return (
    <>
      {cabecera}
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <Text style={[tipo.titulo3, { color: t.texto, paddingHorizontal: 16, marginBottom: 8 }]}>
          {producto.nombre}
        </Text>

        <Grupo titulo="Datos generales" pie="La descripción se edita en Editar producto.">
          <CampoFila
            etiqueta="Marca"
            placeholder="Ej. Acme"
            value={marca}
            onChangeText={setMarca}
            maxLength={FICHA_LIMITES.marca}
          />
          <CampoFila
            etiqueta="Código"
            placeholder="SKU o referencia"
            value={codigo}
            onChangeText={setCodigo}
            autoCapitalize="characters"
            maxLength={FICHA_LIMITES.codigo}
          />
        </Grupo>

        <Grupo
          titulo="Especificaciones"
          pie="Los datos sin valor no se guardan. Puedes renombrar o borrar los campos sugeridos."
        >
          {filas.map((f, i) => (
            <View key={i} style={s.especificacion}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${f.campo || "dato"}`}
                hitSlop={8}
                onPress={() => {
                  tocar();
                  setFilas((l) => l.filter((_, j) => j !== i));
                }}
              >
                <Icono sf="minus.circle.fill" ion="remove-circle" size={22} color={t.rojo} />
              </Pressable>
              <TextInput
                placeholder="Campo"
                placeholderTextColor={t.textoTer}
                selectionColor={t.tinte}
                value={f.campo}
                onChangeText={(campo) => cambiarFila(i, { campo })}
                maxLength={FICHA_LIMITES.campo}
                style={[...estiloInput, { width: 110 }]}
              />
              <TextInput
                placeholder="Valor"
                placeholderTextColor={t.textoTer}
                selectionColor={t.tinte}
                value={f.valor}
                onChangeText={(valor) => cambiarFila(i, { valor })}
                maxLength={FICHA_LIMITES.valor}
                style={[...estiloInput, { flex: 1, minWidth: 0, textAlign: "right" }]}
              />
            </View>
          ))}
          {filas.length < FICHA_LIMITES.especificaciones ? (
            <Fila
              titulo="Agregar dato"
              tinte
              izquierda={<Icono sf="plus.circle.fill" ion="add-circle" size={22} color={t.verde} />}
              onPress={() => setFilas((l) => [...l, { campo: "", valor: "" }])}
            />
          ) : null}
        </Grupo>

        {error ? (
          <Text style={[tipo.nota, { color: t.rojo, paddingHorizontal: 16, marginBottom: 12 }]}>
            {error}
          </Text>
        ) : null}

        <BotonPrincipal onPress={guardar} deshabilitado={!cambio} cargando={guardando}>
          Guardar ficha
        </BotonPrincipal>
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  especificacion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    paddingVertical: 10,
  },
});