import type { LedColor } from "@mi-desorden/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Stepper } from "@/components/Stepper";
import { CampoFila, Contenido, Fila, Grupo, Icono, tocar } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { haceCuanto } from "@/lib/fecha";
import { puedeEditar, useStore } from "@/lib/store";
import { colorLed, tipo, useTema } from "@/lib/theme";

const LEDS: LedColor[] = ["verde", "azul", "amarillo", "rojo", "violeta"];

export default function ProductoForm() {
  const t = useTema();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { productosActivos, guardarProducto, eliminarProducto, miRol } = useStore();
  const existente = id ? productosActivos.find((p) => p.id === id) : undefined;
  const editable = puedeEditar(miRol);

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [categoria, setCategoria] = useState(existente?.categoria ?? "");
  const [cantidad, setCantidad] = useState(existente?.cantidad ?? 1);
  const [minimo, setMinimo] = useState(existente?.minimo ?? 1);
  const [ubicacion, setUbicacion] = useState(existente?.ubicacion ?? "");
  const [led, setLed] = useState<LedColor>(existente?.led ?? "verde");

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = nombre.trim().length > 0 && ubicacion.trim().length > 0 && !guardando;

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarProducto(existente?.id ?? null, {
        nombre: nombre.trim(),
        categoria: categoria.trim() || "General",
        cantidad,
        minimo,
        ubicacion: ubicacion.trim().toUpperCase(),
        led,
      });
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
          headerRight: editable
            ? () => textoHeader(existente ? "Listo" : "Agregar", guardar, true, !valido)
            : undefined,
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
          <CampoFila
            placeholder="Categoría"
            value={categoria}
            onChangeText={setCategoria}
            editable={editable}
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

        <Grupo
          titulo="En la estantería"
          pie="La cámara busca el LED de este color para reconocer el hueco del producto."
        >
          <CampoFila
            etiqueta="Estante"
            placeholder="A1"
            value={ubicacion}
            onChangeText={setUbicacion}
            autoCapitalize="characters"
            editable={editable}
          />
          <View style={s.leds}>
            {LEDS.map((c) => {
              const activo = c === led;
              const hex = colorLed(t, c);
              return (
                <Pressable
                  key={c}
                  accessibilityLabel={`LED ${c}`}
                  accessibilityState={{ selected: activo }}
                  disabled={!editable}
                  onPress={() => (tocar(), setLed(c))}
                  style={[s.anillo, { borderColor: activo ? hex : "transparent" }]}
                >
                  <View style={[s.circulo, { backgroundColor: hex }]}>
                    {activo ? (
                      <Icono sf="checkmark" ion="checkmark" size={16} color="#fff" weight="bold" />
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Grupo>

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
    </>
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
  leds: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  anillo: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  circulo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
