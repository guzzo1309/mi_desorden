import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { admin, mensajeError } from "@/api";
import { PedidosPlan, PedidosResueltos, usePedidosPlan } from "@/components/PedidosPlan";
import { Icono, tocar, Vacio } from "@/components/ui";
import {
  BotonRedondo,
  Encabezado,
  Separador,
  Tarjeta,
  useEntrada,
  Vista,
} from "@/components/vistas";
import { resumenLimites, textoPrecio } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";
import { Pressable } from "react-native";
import type { AdminPlan } from "@mi-desorden/core";

function Fila({ p, pedidos }: { p: AdminPlan; pedidos: number }) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Editar plan ${p.nombre}`}
      onPress={() => {
        tocar();
        router.push({ pathname: "/plan", params: { id: p.id } });
      }}
      style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={s.nombreFila}>
          <Text
            style={[tipo.destacado, { color: p.activo ? t.texto : t.textoTer }]}
            numberOfLines={1}
          >
            {p.nombre}
          </Text>
          {pedidos ? (
            <Text style={[tipo.leyenda, s.pedidos, { color: "#fff", backgroundColor: t.tinte }]}>
              {pedidos} {pedidos === 1 ? "pedido" : "pedidos"}
            </Text>
          ) : null}
          {!p.activo ? (
            <Text
              style={[tipo.leyenda, s.etiqueta, { color: t.textoSec, borderColor: t.textoTer }]}
            >
              Archivado
            </Text>
          ) : null}
        </View>
        <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={2}>
          {resumenLimites(p)}
        </Text>
        <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
          {textoPrecio(p.precio_mensual)} · {p.suscriptores}{" "}
          {p.suscriptores === 1 ? "cuenta" : "cuentas"}
        </Text>
      </View>
      <Icono
        sf="chevron.right"
        ion="chevron-forward"
        size={13}
        color={t.textoTer}
        weight="semibold"
      />
    </Pressable>
  );
}

export default function Planes() {
  const t = useTema();
  const qc = useQueryClient();
  const entrada = useEntrada(3);
  const q = useQuery({ queryKey: ["admin", "planes"], queryFn: admin.planes });
  const lista = q.data;
  const { data: pedidos } = usePedidosPlan();

  return (
    <Vista
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => {
            void q.refetch();
            void qc.invalidateQueries({ queryKey: ["admin"] });
          }}
          tintColor={t.textoSec}
        />
      }
    >
      <Encabezado
        sobre="Admin"
        titulo="Planes"
        accion={
          <BotonRedondo
            sf="plus"
            ion="add"
            etiqueta="Nuevo plan"
            onPress={() => router.push("/plan")}
          />
        }
        style={entrada(0)}
      />

      {q.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
      {q.error && !lista ? (
        <Vacio
          sf="wifi.exclamationmark"
          ion="cloud-offline-outline"
          titulo="No se pudo cargar"
          texto={mensajeError(q.error)}
        />
      ) : null}

      <PedidosPlan style={entrada(1)} />

      {lista ? (
        <View style={{ gap: 6 }}>
          <Tarjeta>
            {lista.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <Separador /> : null}
                <Fila
                  p={p}
                  pedidos={(pedidos ?? []).filter((x) => x.plan_pedido === p.nombre).length}
                />
              </View>
            ))}
          </Tarjeta>
          <Text style={[tipo.nota, s.pie, { color: t.textoSec }]}>
            Un límite vacío es ilimitado. Bajar el límite de un plan no borra nada: solo frena las
            altas nuevas de quienes lo pasen.
          </Text>
        </View>
      ) : null}

      <PedidosResueltos style={entrada(2)} />
    </Vista>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  nombreFila: { flexDirection: "row", alignItems: "center", gap: 8 },
  etiqueta: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: "hidden",
  },
  pedidos: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: "hidden",
    fontWeight: "600",
  },
  pie: { paddingHorizontal: 16 },
});
