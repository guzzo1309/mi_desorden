import type { Moneda } from "@mi-desorden/core";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator } from "react-native";

import { LimiteAlcanzado } from "@/components/LimiteAlcanzado";
import { BotonCabecera, CampoFila, Contenido, Fila, Grupo, Icono } from "@/components/ui";
import { useMiPlan } from "@/lib/miPlan";
import { nivelCupo } from "@/lib/planes";
import { useAcciones, useInventario } from "@/lib/store";
import { useTema } from "@/lib/theme";

const MONEDAS: { clave: Moneda; nombre: string; simbolo: string }[] = [
  { clave: "USD", nombre: "Dólar", simbolo: "$" },
  { clave: "EUR", nombre: "Euro", simbolo: "€" },
];

/** Crea un inventario, o con ?id= edita el nombre, el lugar y la moneda de uno existente. */
export default function InventarioNuevo() {
  const t = useTema();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { crearInventario, editarInventario } = useAcciones();
  const { inventarios } = useInventario();
  const existente = id ? inventarios.find((i) => i.id === id) : undefined;
  const [nombre, setNombre] = useState(existente?.nombre ?? "");
  const [lugar, setLugar] = useState(existente?.lugar ?? "");
  const [moneda, setMoneda] = useState<Moneda>(existente?.moneda ?? "USD");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = nombre.trim().length >= 2 && !guardando;
  // Crear uno más ya no entra en mi plan: en vez del formulario, el aviso.
  const { data: miPlan } = useMiPlan({ fresco: true });
  const lleno =
    !existente &&
    !!miPlan &&
    miPlan.max_inventarios !== null &&
    nivelCupo(miPlan.inventarios_usados, miPlan.max_inventarios) === "lleno";

  async function guardar() {
    if (!valido) return;
    setGuardando(true);
    setError(null);
    try {
      if (existente) {
        // La moneda solo si cambió: así guardar anda aunque falte la migración.
        await editarInventario(
          existente.id,
          nombre,
          lugar,
          moneda !== existente.moneda ? moneda : undefined,
        );
      } else await crearInventario(nombre, lugar, moneda);
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setGuardando(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: existente ? "Editar inventario" : "Nuevo inventario",
          headerLeft: () => <BotonCabecera texto="Volver" atras onPress={() => router.back()} />,
          headerRight: () =>
            lleno ? null : guardando ? (
              <ActivityIndicator style={{ paddingHorizontal: 16 }} />
            ) : (
              <BotonCabecera
                texto={existente ? "Guardar" : "Crear"}
                fuerte
                apagado={!valido}
                onPress={guardar}
              />
            ),
        }}
      />
      {lleno && miPlan?.max_inventarios ? (
        <LimiteAlcanzado
          plan={miPlan.nombre}
          max={miPlan.max_inventarios}
          uno="inventario"
          varios="inventarios"
          puedeMejorar
        />
      ) : (
        <Contenido
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{ paddingTop: 16 }}
        >
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
              autoFocus={!existente}
              returnKeyType="done"
              onSubmitEditing={guardar}
            />
            <CampoFila
              placeholder="Lugar (opcional)"
              value={lugar}
              onChangeText={setLugar}
              returnKeyType="done"
              onSubmitEditing={guardar}
            />
          </Grupo>

          <Grupo
            titulo="Moneda"
            pie="En esta moneda se cargan y se ven los precios de los productos."
          >
            {MONEDAS.map((m) => (
              <Fila
                key={m.clave}
                titulo={`${m.nombre} (${m.simbolo})`}
                onPress={() => setMoneda(m.clave)}
                derecha={
                  moneda === m.clave ? (
                    <Icono
                      sf="checkmark"
                      ion="checkmark"
                      size={18}
                      color={t.tinte}
                      weight="semibold"
                    />
                  ) : null
                }
              />
            ))}
          </Grupo>
        </Contenido>
      )}
    </>
  );
}
