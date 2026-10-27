import { router, Stack } from "expo-router";
import { View } from "react-native";
import { useEsAncho } from '@/lib/pantalla';
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { BotonPrincipal, CampoFila, Contenido, Grupo } from "@/components/ui";
import { useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

export default function InventarioNuevo() {
  const esAncho = useEsAncho();
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
    <View style={[{ flex: 1 }, esAncho && { maxWidth: 500, width: '100%', alignSelf: 'center', marginTop: 40 }]}>
      <Stack.Screen
        options={{
          headerLeft: () => boton("Cancelar", () => router.back()),
        }}
      />
      <Contenido contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 16 }}>
        <Grupo
          pie={
            error ??
            "Por ejemplo: Depósito, Taller o Casa. Cada inventario tiene sus productos y su propia gente con acceso."
          }
          pieError={!!error}
        >
          <CampoFila
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={crear}
          />
          <CampoFila
            placeholder="Lugar (opcional)"
            value={lugar}
            onChangeText={setLugar}
            returnKeyType="done"
            onSubmitEditing={crear}
          />
        </Grupo>
        {/* En el contenido y no en el encabezado: en iOS 26 los botones del encabezado
            del modal perdían el primer toque con el teclado abierto. */}
        <BotonPrincipal onPress={crear} deshabilitado={!valido} cargando={guardando}>
          Crear inventario
        </BotonPrincipal>
      </Contenido>
    </View>
  );
}
