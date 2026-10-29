import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";

import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
} from "@/components/ui";
import { useAcciones, useInventario } from "@/lib/store";
import { useTema } from "@/lib/theme";

/**
 * Crear o renombrar una categoría.
 * - /categoria                      → nueva categoría principal (o elegir dentro de cuál)
 * - /categoria?padre=<id>           → nueva subcategoría de esa
 * - /categoria?id=<id>              → renombrar
 * - /categoria?luego=producto       → al crearla, sigue con un producto adentro
 */
export default function CategoriaForm() {
  const t = useTema();
  const params = useLocalSearchParams<{ id?: string; padre?: string; luego?: string }>();
  const { categoriasActivas } = useInventario();
  const { crearCategoria, renombrarCategoria } = useAcciones();
  const existente = params.id ? categoriasActivas.find((c) => c.id === params.id) : undefined;

  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [padreId, setPadreId] = useState<string | null>(params.padre ?? null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = nombre.trim().length > 0 && !guardando;

  // Solo las principales pueden tener subcategorías (un nivel).
  const principales = categoriasActivas
    .filter((c) => !c.padre_id)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const padreFijo = params.padre ? principales.find((c) => c.id === params.padre) : undefined;

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      if (existente) {
        await renombrarCategoria(existente.id, nombre);
        router.back();
        return;
      }
      const nueva = await crearCategoria(nombre, padreId);
      if (params.luego === "producto") {
        router.replace({ pathname: "/producto", params: { categoria: nueva.id } });
      } else {
        router.back();
      }
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: existente
            ? "Renombrar categoría"
            : padreFijo
              ? "Nueva subcategoría"
              : "Nueva categoría",
          headerLeft: () => <BotonCabecera texto="Cancelar" onPress={() => router.back()} />,
        }}
      />
      <Contenido contentInsetAdjustmentBehavior="never" contentContainerStyle={{ paddingTop: 16 }}>
        <Grupo
          pie={
            error ??
            (padreFijo
              ? `Va a quedar dentro de “${padreFijo.nombre}”.`
              : "Por ejemplo: Bebidas, Herramientas o Limpieza. Después agregas los productos adentro.")
          }
          pieError={!!error}
        >
          <CampoFila
            placeholder="Nombre"
            value={nombre}
            onChangeText={(v) => (setNombre(v), setError(null))}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={guardar}
            maxLength={60}
          />
        </Grupo>

        {/* Dentro de qué categoría: solo al crear, sin padre fijo y si hay principales. */}
        {!existente && !padreFijo && principales.length ? (
          <Grupo titulo="Dentro de" pie="Elige una para crear una subcategoría.">
            {[null, ...principales].map((c) => {
              const id = c?.id ?? null;
              return (
                <Fila
                  key={id ?? "ninguna"}
                  titulo={c?.nombre ?? "Ninguna (categoría principal)"}
                  onPress={() => setPadreId(id)}
                  derecha={
                    padreId === id ? (
                      <Icono
                        sf="checkmark"
                        ion="checkmark"
                        size={17}
                        color={t.tinte}
                        weight="semibold"
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </Grupo>
        ) : null}

        <BotonPrincipal onPress={guardar} deshabilitado={!valido} cargando={guardando}>
          {existente ? "Guardar" : "Crear categoría"}
        </BotonPrincipal>
      </Contenido>
    </>
  );
}
