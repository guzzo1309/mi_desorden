import type { AdminResumen } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from "react-native";
import { admin, mensajeError } from "@/api";
import { Vacio } from "@/components/ui";
import { Encabezado, Seccion, Tarjeta, useEntrada, Vista } from "@/components/vistas";
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
  const entrada = useEntrada(4);
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
  barras: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 72 },
  barraCol: { flex: 1, justifyContent: "flex-end" },
  barra: { borderRadius: 4 },
});
