import type { AdminPedidoPlan } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { admin } from "@/api";
import { tocar } from "@/components/ui";
import { Seccion, Separador, Tarjeta, type EstiloAnimado } from "@/components/vistas";
import { confirmar } from "@/lib/confirmar";
import { estadoPedido } from "@/lib/planes";
import { haceCuanto } from "@/lib/fecha";
import { tipo, useTema } from "@/lib/theme";

/** Los pedidos de cambio de plan que esperan respuesta del admin. */
export function usePedidosPlan(habilitado = true) {
  return useQuery({
    queryKey: ["admin", "pedidos"],
    queryFn: admin.pedidos,
    enabled: habilitado,
  });
}

/** Botón chico de una fila (Aprobar / Rechazar). */
function BotonChico({
  texto,
  onPress,
  fuerte,
  apagado,
}: {
  texto: string;
  onPress: () => void;
  fuerte?: boolean;
  apagado?: boolean;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={apagado}
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => [
        s.botonChico,
        {
          backgroundColor: fuerte ? t.tinte : t.relleno,
          opacity: apagado ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[tipo.subtitulo, { color: fuerte ? "#fff" : t.texto, fontWeight: "600" }]}>
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * Lista de pedidos de plan con Aprobar y Rechazar en la misma fila. Aprobar cambia
 * el plan de la cuenta al instante; tocar el nombre abre su cuenta. No muestra nada
 * si no hay pedidos.
 */
export function PedidosPlan({ style }: { style?: EstiloAnimado }) {
  const t = useTema();
  const qc = useQueryClient();
  const { data: pedidos } = usePedidosPlan();
  const [resolviendo, setResolviendo] = useState<string | null>(null);

  if (!pedidos?.length) return null;

  async function resolver(p: AdminPedidoPlan, aprobar: boolean) {
    setResolviendo(p.id);
    try {
      await admin.resolverPedido(p.id, aprobar);
      await qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      Alert.alert("No se pudo resolver", (e as Error).message);
    } finally {
      setResolviendo(null);
    }
  }

  return (
    <Seccion
      titulo={`Pedidos de plan (${pedidos.length})`}
      pie="Aprobar cambia el plan de la cuenta al instante."
      style={style}
    >
      <Tarjeta>
        {pedidos.map((p, i) => (
          <View key={p.id}>
            {i > 0 ? <Separador /> : null}
            <View style={s.pedido}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Abrir la cuenta de ${p.nombre}`}
                onPress={() => {
                  tocar();
                  router.push({ pathname: "/usuario", params: { id: p.usuario_id } });
                }}
                style={{ gap: 2 }}
              >
                <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={1}>
                  {p.nombre}
                </Text>
                <Text style={[tipo.nota, { color: t.tinte }]} numberOfLines={1}>
                  {p.plan_actual} → {p.plan_pedido} · {haceCuanto(p.creado_en)}
                </Text>
                {p.motivo ? (
                  <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={2}>
                    “{p.motivo}”
                  </Text>
                ) : null}
              </Pressable>
              <View style={s.acciones}>
                <BotonChico
                  texto="Rechazar"
                  apagado={resolviendo === p.id}
                  onPress={() =>
                    confirmar(
                      `¿Rechazar el pedido de ${p.nombre}?`,
                      `Se queda en ${p.plan_actual}.`,
                      "Rechazar",
                      () => void resolver(p, false),
                    )
                  }
                />
                <BotonChico
                  texto={resolviendo === p.id ? "…" : `Aprobar ${p.plan_pedido}`}
                  fuerte
                  apagado={resolviendo === p.id}
                  onPress={() => void resolver(p, true)}
                />
              </View>
            </View>
          </View>
        ))}
      </Tarjeta>
    </Seccion>
  );
}

/**
 * Los últimos pedidos ya resueltos: quién pidió qué plan, cómo terminó y cuándo. Así un
 * pedido aprobado, rechazado o cancelado no desaparece sin dejar rastro.
 */
export function PedidosResueltos({ style }: { style?: EstiloAnimado }) {
  const t = useTema();
  const { data } = useQuery({
    queryKey: ["admin", "pedidos-resueltos"],
    queryFn: () => admin.pedidosResueltos(),
  });
  if (!data?.length) return null;
  const colores = { verde: t.verde, rojo: t.rojo, gris: t.textoSec };

  return (
    <Seccion
      titulo="Pedidos resueltos"
      pie="Los últimos 20. Un pedido aprobado cambió el plan de la cuenta."
      style={style}
    >
      <Tarjeta>
        {data.map((p, i) => {
          const estado = estadoPedido(p.estado);
          const color = colores[estado.color];
          return (
            <View key={p.id}>
              {i > 0 ? <Separador /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${p.nombre}, ${p.plan_pedido}, ${estado.texto}`}
                onPress={() => {
                  tocar();
                  router.push({ pathname: "/usuario", params: { id: p.usuario_id } });
                }}
                style={({ pressed }) => [s.resuelto, pressed && { backgroundColor: t.relleno }]}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={1}>
                    {p.nombre} → {p.plan_pedido}
                  </Text>
                  <Text style={[tipo.nota, { color }]} numberOfLines={1}>
                    {estado.texto}
                    {p.resuelto_por_nombre ? ` por ${p.resuelto_por_nombre}` : ""}
                    {" · "}
                    {haceCuanto(p.resuelto_en ?? p.creado_en)}
                  </Text>
                  {p.motivo ? (
                    <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
                      “{p.motivo}”
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </Tarjeta>
    </Seccion>
  );
}

const s = StyleSheet.create({
  resuelto: { paddingHorizontal: 16, paddingVertical: 12 },
  pedido: { padding: 16, gap: 12 },
  acciones: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  botonChico: { height: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: "center" },
});
