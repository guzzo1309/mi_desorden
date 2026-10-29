import type { AdminResumen } from "@mi-desorden/core";
import type { AdminPedidoPlan } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { admin, mensajeError } from "@/api";
import { Icono, tocar, Vacio } from "@/components/ui";
import { Encabezado, Seccion, Separador, Tarjeta, useEntrada, Vista } from "@/components/vistas";
import { haceCuanto } from "@/lib/fecha";
import { textoCerca } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

const num = (n: number) => n.toLocaleString("es");

/** Un número grande con su etiqueta. `destacado` lo pinta en el color de la marca. */
function Dato({
  valor,
  etiqueta,
  destacado,
}: {
  valor: number;
  etiqueta: string;
  destacado?: boolean;
}) {
  const t = useTema();
  return (
    <View style={[s.dato, { backgroundColor: destacado ? t.tinte : t.celda }]}>
      <Text
        style={[s.valor, { color: destacado ? "#fff" : t.texto }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {num(valor)}
      </Text>
      <Text style={[tipo.nota, { color: destacado ? "#fff" : t.textoSec }]} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

/** Barras simples: una por día, la más alta ocupa todo el alto. */
function Altas({ dias }: { dias: AdminResumen["altas_por_dia"] }) {
  const t = useTema();
  const max = Math.max(1, ...dias.map((d) => d.altas));
  return (
    <View style={s.barras} accessibilityLabel="Altas por día, últimos 14 días">
      {dias.map((d) => (
        <View key={d.dia} style={s.barraCol}>
          <View
            style={[
              s.barra,
              {
                height: Math.max(3, (d.altas / max) * 72),
                backgroundColor: d.altas ? t.tinte : t.relleno,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export default function Resumen() {
  const t = useTema();
  const qc = useQueryClient();
  const pedidosQ = useQuery({ queryKey: ["admin", "pedidos"], queryFn: admin.pedidos });

  /** Aprobar cambia el plan de la cuenta; rechazar solo cierra el pedido. */
  function resolver(p: AdminPedidoPlan) {
    const actualizar = () => qc.invalidateQueries({ queryKey: ["admin"] });
    const hacer = (aprobar: boolean) =>
      admin
        .resolverPedido(p.id, aprobar)
        .then(actualizar)
        .catch((e: Error) => Alert.alert("No se pudo resolver", e.message));
    const titulo = `${p.nombre}: ${p.plan_actual} → ${p.plan_pedido}`;
    const mensaje = p.motivo ? `“${p.motivo}”` : "Sin motivo.";
    if (Platform.OS === "web") {
      if (window.confirm(`${titulo}\n\n${mensaje}\n\n¿Aprobar el cambio?`)) void hacer(true);
      return;
    }
    Alert.alert(titulo, mensaje, [
      { text: "Rechazar", style: "destructive", onPress: () => void hacer(false) },
      { text: "Aprobar", onPress: () => void hacer(true) },
      { text: "Cerrar", style: "cancel" },
    ]);
  }

  const entrada = useEntrada(5);
  const q = useQuery({ queryKey: ["admin", "resumen"], queryFn: admin.resumen });
  const r = q.data;

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
      <Encabezado sobre="Admin" titulo="Resumen" style={entrada(0)} />

      {q.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
      {q.error && !r ? (
        <Vacio
          sf="wifi.exclamationmark"
          ion="cloud-offline-outline"
          titulo="No se pudo cargar"
          texto={mensajeError(q.error)}
        />
      ) : null}

      {r ? (
        <>
          <Seccion titulo="Cuentas" style={entrada(1)}>
            <View style={s.fila}>
              <Dato valor={r.cuentas} etiqueta="Cuentas" destacado />
              <Dato valor={r.activos_7d} etiqueta="Activas (7 d)" />
            </View>
            <View style={s.fila}>
              <Dato valor={r.nuevas_7d} etiqueta="Nuevas (7 d)" />
              <Dato valor={r.nuevas_30d} etiqueta="Nuevas (30 d)" />
            </View>
          </Seccion>

          <Seccion
            titulo="Altas, últimos 14 días"
            pie={`${num(r.altas_por_dia.reduce((a, d) => a + d.altas, 0))} cuentas nuevas en el período.`}
            style={entrada(2)}
          >
            <Tarjeta style={s.grafico}>
              <Altas dias={r.altas_por_dia} />
            </Tarjeta>
          </Seccion>

          {pedidosQ.data?.length ? (
            <Seccion
              titulo={`Pedidos de plan (${pedidosQ.data.length})`}
              pie="Toca un pedido para aprobarlo (cambia el plan de la cuenta) o rechazarlo."
              style={entrada(1)}
            >
              <Tarjeta>
                {pedidosQ.data.map((p, i) => (
                  <View key={p.id}>
                    {i > 0 ? <Separador /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${p.nombre} pide pasar de ${p.plan_actual} a ${p.plan_pedido}`}
                      onPress={() => {
                        tocar();
                        resolver(p);
                      }}
                      style={({ pressed }) => [
                        s.filaPlan,
                        pressed && { backgroundColor: t.relleno },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={1}>
                          {p.nombre}
                        </Text>
                        <Text style={[tipo.nota, { color: t.tinte }]} numberOfLines={1}>
                          {p.plan_actual} → {p.plan_pedido} · {haceCuanto(p.creado_en)}
                        </Text>
                        {p.motivo ? (
                          <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={2}>
                            {p.motivo}
                          </Text>
                        ) : null}
                      </View>
                      <Icono
                        sf="chevron.right"
                        ion="chevron-forward"
                        size={13}
                        color={t.textoTer}
                        weight="semibold"
                      />
                    </Pressable>
                  </View>
                ))}
              </Tarjeta>
            </Seccion>
          ) : null}

          {(r.por_plan ?? []).length ? (
            <Seccion titulo="Cuentas por plan" style={entrada(3)}>
              <Tarjeta>
                {r.por_plan.map((p, i) => (
                  <View key={p.codigo}>
                    {i > 0 ? <Separador /> : null}
                    <View style={s.filaPlan}>
                      <Text style={[tipo.cuerpo, { color: t.texto }]}>{p.nombre}</Text>
                      <Text style={[tipo.cuerpo, { color: t.textoSec }]}>{p.cuentas}</Text>
                    </View>
                  </View>
                ))}
              </Tarjeta>
            </Seccion>
          ) : null}

          {(r.cerca_limite ?? []).length ? (
            <Seccion
              titulo="Cerca del límite"
              pie="Cuentas al 80 % o más de su plan: candidatas a cambiar de plan."
              style={entrada(3)}
            >
              <Tarjeta>
                {r.cerca_limite.map((c, i) => (
                  <View key={`${c.usuario_id}-${c.recurso}-${c.inventario ?? ""}`}>
                    {i > 0 ? <Separador /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${c.nombre}, ${textoCerca(c)}`}
                      onPress={() => {
                        tocar();
                        router.push({ pathname: "/usuario", params: { id: c.usuario_id } });
                      }}
                      style={({ pressed }) => [
                        s.filaPlan,
                        pressed && { backgroundColor: t.relleno },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                        <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={1}>
                          {c.nombre} · {c.plan}
                        </Text>
                        <Text
                          style={[tipo.nota, { color: c.usados >= c.max ? t.rojo : t.tinte }]}
                          numberOfLines={1}
                        >
                          {textoCerca(c)}
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
                  </View>
                ))}
              </Tarjeta>
            </Seccion>
          ) : null}

          <Seccion titulo="Uso" style={entrada(3)}>
            <View style={s.fila}>
              <Dato valor={r.inventarios} etiqueta="Inventarios" />
              <Dato valor={r.productos} etiqueta="Productos" />
            </View>
            <View style={s.fila}>
              <Dato valor={r.categorias} etiqueta="Categorías" />
              <Dato valor={r.invitaciones} etiqueta="Invitaciones pendientes" />
            </View>
          </Seccion>
        </>
      ) : null}
    </Vista>
  );
}

const s = StyleSheet.create({
  fila: { flexDirection: "row", gap: 8 },
  dato: {
    flex: 1,
    minWidth: 0,
    borderRadius: 22,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 2,
  },
  valor: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5, fontVariant: ["tabular-nums"] },
  grafico: { padding: 16 },
  filaPlan: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  barras: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 72 },
  barraCol: { flex: 1, justifyContent: "flex-end" },
  barra: { borderRadius: 4 },
});
