import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { CampoFila, Contenido, Grupo } from "@/components/ui";
import { useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

export default function InventarioNuevo() {
  const t = useTema();
  const { crearInventario } = useStore();
  const [nombre, setNombre] = useState("");
  const [lugar, setLugar] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = nombre.trim().length >= 2 && !guardando;

  async function crear() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      await crearInventario(nombre, lugar);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  const boton = (texto: string, onPress: () => void, fuerte?: boolean, apagado?: boolean) => (
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
          headerLeft: () => boton("Cancelar", () => router.back()),
          headerRight: () => boton("Crear", crear, true, !valido),
        }}
      />
      <Contenido contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 16 }}>
        <Grupo
          pie={
            error ??
            "Cada inventario tiene sus productos, sus cámaras y su propia gente con acceso."
          }
          pieError={!!error}
        >
          <CampoFila
            placeholder="Nombre (ej. Bodega norte)"
            value={nombre}
            onChangeText={setNombre}
            autoFocus
            onSubmitEditing={crear}
          />
          <CampoFila
            placeholder="Lugar (ej. Pasillo 3)"
            value={lugar}
            onChangeText={setLugar}
            onSubmitEditing={crear}
          />
        </Grupo>
      </Contenido>
    </>
  );
}
