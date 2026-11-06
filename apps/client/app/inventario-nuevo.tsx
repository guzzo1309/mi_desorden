import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { BotonCabecera, BotonPrincipal, CampoFila, Contenido, Grupo } from "@/components/ui";
import { useAcciones, useInventario } from "@/lib/store";

/** Crea un inventario, o con ?id= edita el nombre y el lugar de uno existente. */
export default function InventarioNuevo() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { crearInventario, editarInventario } = useAcciones();
  const { inventarios } = useInventario();
  const existente = id ? inventarios.find((i) => i.id === id) : undefined;
  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [lugar, setLugar] = useState(existente?.lugar ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = nombre.trim().length >= 2 && !guardando;

  async function crear() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      if (existente) await editarInventario(existente.id, nombre, lugar);
      else await crearInventario(nombre, lugar);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  const boton = (texto: string, onPress: () => void, fuerte?: boolean, apagado?: boolean) => (
    <BotonCabecera texto={texto} onPress={onPress} fuerte={fuerte} apagado={apagado} />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Editar inventario" : "Nuevo inventario",
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
          {existente ? "Guardar cambios" : "Crear inventario"}
        </BotonPrincipal>
      </Contenido>
    </>
  );
}
