import type { Solicitud } from "@mi-desorden/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { mensajeError } from "@/api";
import { Stepper } from "@/components/Stepper";
import { BotonPrincipal, CampoFila, Contenido, Fila, Grupo } from "@/components/ui";
import { useInventario, useSolicitudes } from "@/lib/store";
import { tipo as tipografia, useTema } from "@/lib/theme";

/**
 * Pedirle algo a quien edita el inventario (owner o editor).
 * - /solicitud?tipo=agregar[&nombre=…]   → que agreguen un producto
 * - /solicitud?tipo=eliminar&producto=id → que lo eliminen
 * - /solicitud?tipo=stock&producto=id    → que cambien la cantidad
 */
export default function SolicitudForm() {
  const t = useTema();
  const params = useLocalSearchParams<{ tipo?: string; producto?: string; nombre?: string }>();
  const tipo: Solicitud["tipo"] =
    params.tipo === "eliminar" || params.tipo === "stock" ? params.tipo : "agregar";
  const { productosActivos, activo } = useInventario();
  const { pedir } = useSolicitudes();
  const producto = params.producto
    ? productosActivos.find((p) => p.id === params.producto)
    : undefined;

  const [nombre, setNombre] = useState(params.nombre ?? "");
  const [nota, setNota] = useState("");
  const [cantidad, setCantidad] = useState(producto?.cantidad ?? 0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const falta = tipo === "agregar" ? !nombre.trim() : !producto;
  const valido = !falta && !enviando && (tipo !== "stock" || cantidad !== producto?.cantidad);

  async function enviar() {
    if (!valido) return;
    setEnviando(true);
    setError(null);
    try {
      await pedir(
        tipo === "agregar"
          ? { tipo, detalle: [nombre.trim(), nota.trim()].filter(Boolean).join(" · ") }
          : {
              tipo,
              producto_id: producto!.id,
              cantidad: tipo === "stock" ? cantidad : null,
              detalle: nota,
            },
      );
      router.back();
    } catch (e) {
      setError(mensajeError(e));
      setEnviando(false);
    }
  }

  const titulo =
    tipo === "agregar"
      ? "Pedir un producto"
      : tipo === "eliminar"
        ? "Pedir que lo eliminen"
        : "Pedir otra cantidad";

  return (
    <>
      <Stack.Screen
        options={{
          title: titulo,
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text style={[tipografia.cuerpo, { color: t.tinte }]}>Cancelar</Text>
            </Pressable>
          ),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {tipo === "agregar" ? (
          <Grupo
            titulo="Producto"
            pie={`Le llega al owner y a los editores de ${activo?.nombre ?? "este inventario"}.`}
          >
            <CampoFila
              placeholder="Nombre del producto"
              value={nombre}
              onChangeText={setNombre}
              autoFocus
              maxLength={120}
            />
          </Grupo>
        ) : producto ? (
          <Grupo
            titulo="Producto"
            pie={
              tipo === "eliminar"
                ? "Si lo aceptan, se borra del inventario para todos."
                : "Si lo aceptan, la cantidad cambia para todos."
            }
          >
            <Fila titulo={producto.nombre} valor={`Hay ${producto.cantidad}`} />
            {tipo === "stock" ? (
              <Fila
                titulo="Cantidad que pides"
                derecha={
                  <View style={s.numero}>
                    <Text style={[tipografia.cuerpo, s.cifra, { color: t.texto }]}>{cantidad}</Text>
                    <Stepper valor={cantidad} onCambio={setCantidad} />
                  </View>
                }
              />
            ) : null}
          </Grupo>
        ) : (
          <Text style={[tipografia.cuerpo, { color: t.textoSec, textAlign: "center" }]}>
            No encontramos ese producto.
          </Text>
        )}

        <Grupo titulo="Nota (opcional)" pie={error ?? undefined} pieError={!!error}>
          <CampoFila
            placeholder={tipo === "agregar" ? "Marca, tamaño, dónde va…" : "Por qué lo pides"}
            value={nota}
            onChangeText={setNota}
            maxLength={200}
          />
        </Grupo>

        <BotonPrincipal onPress={enviar} deshabilitado={!valido} cargando={enviando}>
          Enviar pedido
        </BotonPrincipal>
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  numero: { flexDirection: "row", alignItems: "center", gap: 12 },
  cifra: { fontVariant: ["tabular-nums"], minWidth: 28, textAlign: "right" },
});
