import type { AdminPlan, AdminUsuario } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { admin, mensajeError } from "@/api";
import { Avatar, Icono, Vacio } from "@/components/ui";
import { MenuPuntos } from "@/components/menus";
import { Encabezado, Separador, Tarjeta, useEntrada, Vista } from "@/components/vistas";
import { haceCuanto } from "@/lib/fecha";
import { tipo, useTema } from "@/lib/theme";

function Fila({ u, planes }: { u: AdminUsuario; planes: AdminPlan[] }) {
  const t = useTema();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  function asignar(plan: AdminPlan) {
    setError(null);
    admin
      .asignarPlan(u.id, plan.id)
      .then(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: ["admin", "usuarios"] }),
          qc.invalidateQueries({ queryKey: ["admin", "planes"] }),
        ]),
      )
      .catch((e: Error) => setError(e.message));
  }

  const sub =
    `${u.inventarios} ${u.inventarios === 1 ? "inventario" : "inventarios"}` +
    ` · ${u.ultimo_acceso ? `activo ${haceCuanto(u.ultimo_acceso)}` : "sin ingresar"}`;
  return (
    <View style={s.fila} accessible accessibilityLabel={`${u.nombre}, ${u.email}. ${sub}`}>
      <Avatar nombre={u.nombre} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <View style={s.nombreFila}>
          <Text style={[tipo.destacado, { color: t.texto, flexShrink: 1 }]} numberOfLines={1}>
            {u.nombre}
          </Text>
          <Text style={[tipo.leyenda, s.plan, { color: t.textoSec, backgroundColor: t.relleno }]}>
            {u.plan_nombre}
          </Text>
          {u.es_admin ? (
            <Text style={[tipo.leyenda, s.admin, { color: t.tinte, borderColor: t.tinte }]}>
              Admin
            </Text>
          ) : null}
        </View>
        <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
          {u.email}
        </Text>
        <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
          {sub}
        </Text>
        {error ? <Text style={[tipo.nota, { color: t.rojo }]}>{error}</Text> : null}
      </View>
      <MenuPuntos
        titulo={`el plan de ${u.nombre}`}
        grupos={[
          planes
            .filter((p) => p.activo)
            .map((p) => ({
              etiqueta: p.id === u.plan_id ? `${p.nombre} (actual)` : p.nombre,
              sf: p.id === u.plan_id ? ("checkmark" as const) : ("star" as const),
              deshabilitada: p.id === u.plan_id,
              onPress: () => asignar(p),
            })),
        ]}
      />
    </View>
  );
}

export default function Usuarios() {
  const t = useTema();
  const entrada = useEntrada(3);
  const [busqueda, setBusqueda] = useState("");
  const q = useQuery({ queryKey: ["admin", "usuarios"], queryFn: admin.usuarios });
  const planesQ = useQuery({ queryKey: ["admin", "planes"], queryFn: admin.planes });
  const todos = q.data;

  const lista = useMemo(() => {
    const b = busqueda.trim().toLowerCase();
    return (todos ?? []).filter(
      (u) => !b || u.nombre.toLowerCase().includes(b) || u.email.toLowerCase().includes(b),
    );
  }, [todos, busqueda]);

  return (
    <Vista
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
          tintColor={t.textoSec}
        />
      }
    >
      <Encabezado sobre="Admin" titulo="Usuarios" style={entrada(0)} />

      {q.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
      {q.error && !todos ? (
        <Vacio
          sf="wifi.exclamationmark"
          ion="cloud-offline-outline"
          titulo="No se pudo cargar"
          texto={mensajeError(q.error)}
        />
      ) : null}

      {todos ? (
        <>
          <View style={[s.buscar, { backgroundColor: t.relleno }]}>
            <Icono sf="magnifyingglass" ion="search" size={17} color={t.textoSec} />
            <TextInput
              placeholder="Buscar por nombre o correo…"
              placeholderTextColor={t.textoTer}
              accessibilityLabel="Buscar usuarios"
              value={busqueda}
              onChangeText={setBusqueda}
              clearButtonMode="while-editing"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              selectionColor={t.tinte}
              style={[s.buscarInput, { color: t.texto }]}
            />
          </View>

          {lista.length ? (
            <View style={{ gap: 6 }}>
              <Tarjeta>
                {lista.map((u, i) => (
                  <View key={u.id}>
                    {i > 0 ? <Separador sangria={68} /> : null}
                    <Fila u={u} planes={planesQ.data ?? []} />
                  </View>
                ))}
              </Tarjeta>
              <Text style={[tipo.nota, s.pie, { color: t.textoSec }]}>
                {lista.length} de {todos.length} cuentas
              </Text>
            </View>
          ) : (
            <Vacio
              sf="magnifyingglass"
              ion="search"
              titulo="Sin resultados"
              texto="Probá con otro nombre o correo."
            />
          )}
        </>
      ) : null}
    </Vista>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  plan: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" },
  admin: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  buscar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  buscarInput: { flex: 1, minWidth: 0, fontSize: 17, letterSpacing: -0.4, paddingVertical: 0 },
  pie: { paddingHorizontal: 16 },
});
