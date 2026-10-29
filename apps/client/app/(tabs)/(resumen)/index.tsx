import type { AdminResumen, CercaDelLimite } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { admin, mensajeError } from "@/api";
import { usePedidosPlan } from "@/components/PedidosPlan";
import { Icono, tocar, Vacio } from "@/components/ui";
import { Encabezado, Seccion, Separador, Tarjeta, useEntrada, Vista } from "@/components/vistas";
import { diaMes, haceCuanto } from "@/lib/fecha";
import { textoCerca } from "@/lib/planes";
import { porcentaje } from "@/lib/resumen";
import { tipo, useTema } from "@/lib/theme";

const num = (n: number) => n.toLocaleString("es");

/** Tarjeta de un número con una línea de contexto debajo. */
function Dato({
  valor,
  etiqueta,
  sub,
  destacado,
}: {
  valor: number;
  etiqueta: string;
  sub?: string;
  destacado?: boolean;
}) {
  const t = useTema();
  return (
    <View
      style={[s.dato, { backgroundColor: destacado ? t.tinte : t.celda }]}
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}${sub ? `. ${sub}` : ""}`}
    >
      <Text
        style={[s.valor, { color: destacado ? "#fff" : t.texto }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {num(valor)}
      </Text>
      <Text
        style={[tipo.nota, { color: destacado ? "#fff" : t.texto, fontWeight: "600" }]}
        numberOfLines={1}
      >
        {etiqueta}
      </Text>
      {sub ? (
        <Text
          style={[s.sub, { color: destacado ? "rgba(255,255,255,0.85)" : t.textoSec }]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Barras de las altas por día, con el primer día y "hoy" en el eje; hoy va destacado. */
function Altas({ dias }: { dias: AdminResumen["altas_por_dia"] }) {
  const t = useTema();
  const max = Math.max(1, ...dias.map((d) => d.altas));
  const total = dias.reduce((a, d) => a + d.altas, 0);
  return (
    <View
      accessible
      accessibilityLabel={`Altas por día, últimos ${dias.length} días: ${total} en total, máximo ${max} en un día`}
    >
      <View style={s.barras}>
        {dias.map((d, i) => (
          <View key={d.dia} style={s.barraCol}>
            <View
              style={[
                s.barra,
                {
                  height: Math.max(3, (d.altas / max) * 72),
                  backgroundColor: !d.altas ? t.relleno : i === dias.length - 1 ? t.tinte : t.azul,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={s.eje}>
        <Text style={[tipo.leyenda, { color: t.textoSec }]}>
          {dias[0] ? diaMes(dias[0].dia) : ""}
        </Text>
        <Text style={[tipo.leyenda, { color: t.textoSec }]}>máx. {max} por día</Text>
        <Text style={[tipo.leyenda, { color: t.textoSec }]}>hoy</Text>
      </View>
    </View>
  );
}

/** Cuentas por plan: una barra partida en colores y una leyenda con el número y el porcentaje. */
function PlanesBarra({ planes }: { planes: AdminResumen["por_plan"] }) {
  const t = useTema();
  const colores = [t.azul, t.tinte, t.violeta, t.verde, t.rojo];
  const total = planes.reduce((a, p) => a + p.cuentas, 0);
  return (
    <Tarjeta style={s.grafico}>
      <View style={[s.partida, { backgroundColor: t.relleno }]}>
        {planes
          .filter((p) => p.cuentas > 0)
          .map((p) => (
            <View
              key={p.codigo}
              style={{
                flex: p.cuentas,
                backgroundColor: colores[planes.indexOf(p) % colores.length],
              }}
            />
          ))}
      </View>
      <View style={{ gap: 10, marginTop: 14 }}>
        {planes.map((p, i) => (
          <View
            key={p.codigo}
            style={s.leyenda}
            accessible
            accessibilityLabel={`${p.nombre}: ${p.cuentas} cuentas`}
          >
            <View style={[s.punto, { backgroundColor: colores[i % colores.length] }]} />
            <Text style={[tipo.cuerpo, { color: t.texto, flex: 1 }]}>{p.nombre}</Text>
            <Text style={[tipo.cuerpo, { color: t.texto, fontVariant: ["tabular-nums"] }]}>
              {p.cuentas}
            </Text>
            <Text style={[tipo.nota, { color: t.textoSec, width: 42, textAlign: "right" }]}>
              {total ? `${porcentaje(p.cuentas, total)} %` : "—"}
            </Text>
          </View>
        ))}
      </View>
    </Tarjeta>
  );
}

export default function Resumen() {
  const t = useTema();
  const entrada = useEntrada(6);
  const q = useQuery({ queryKey: ["admin", "resumen"], queryFn: admin.resumen });
  const pedidosQ = usePedidosPlan();
  const r = q.data;
  const pedidos = pedidosQ.data ?? [];
  const cerca = r?.cerca_limite ?? [];

  const abrirCuenta = (id: string) => {
    tocar();
    router.push({ pathname: "/usuario", params: { id } });
  };

  const actualizado = q.dataUpdatedAt
    ? ` · actualizado ${haceCuanto(new Date(q.dataUpdatedAt).toISOString())}`
    : "";

  return (
    <Vista
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => {
            void q.refetch();
            void pedidosQ.refetch();
          }}
          tintColor={t.textoSec}
        />
      }
    >
      <Encabezado sobre={`Admin${actualizado}`} titulo="Resumen" style={entrada(0)} />

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
          {/* Lo que pide una acción tuya va primero */}
          {pedidos.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Abre Planes, donde apruebas o rechazas los pedidos"
              onPress={() => (tocar(), router.navigate("/(tabs)/(planes)"))}
              style={({ pressed }) => [
                s.aviso,
                { backgroundColor: t.tinte, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Icono sf="bell.badge.fill" ion="notifications" size={22} color="#fff" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[tipo.destacado, { color: "#fff" }]}>
                  {pedidos.length === 1
                    ? "1 pedido de plan pendiente"
                    : `${pedidos.length} pedidos de plan pendientes`}
                </Text>
                <Text style={[tipo.nota, { color: "rgba(255,255,255,0.85)" }]} numberOfLines={1}>
                  {pedidos[0]!.nombre}: {pedidos[0]!.plan_actual} → {pedidos[0]!.plan_pedido}
                  {pedidos.length > 1 ? ` y ${pedidos.length - 1} más` : ""}
                </Text>
              </View>
              <Text style={[tipo.subtitulo, { color: "#fff", fontWeight: "600" }]}>Revisar</Text>
            </Pressable>
          ) : null}

          {cerca.length ? (
            <Seccion
              titulo="Cerca del límite"
              pie="Cuentas al 80 % o más de su plan: candidatas a cambiar de plan."
              style={entrada(1)}
            >
              <Tarjeta>
                {cerca.map((c, i) => (
                  <View key={`${c.usuario_id}-${c.recurso}-${c.inventario ?? ""}`}>
                    {i > 0 ? <Separador /> : null}
                    <FilaLimite c={c} onPress={() => abrirCuenta(c.usuario_id)} />
                  </View>
                ))}
              </Tarjeta>
            </Seccion>
          ) : null}

          {/* Números de la plataforma, cada uno con su contexto */}
          <BloqueAnimado style={entrada(2)}>
            <View style={s.fila}>
              <Dato
                valor={r.cuentas}
                etiqueta="Cuentas"
                sub={r.nuevas_7d ? `+${r.nuevas_7d} en 7 días` : "sin altas en 7 días"}
                destacado
              />
              <Dato
                valor={r.activos_7d}
                etiqueta="Activas"
                sub={
                  r.cuentas ? `${porcentaje(r.activos_7d, r.cuentas)} % · 7 días` : "últimos 7 días"
                }
              />
              <Dato
                valor={r.inventarios}
                etiqueta="Inventarios"
                sub={`${num(r.productos)} ${r.productos === 1 ? "producto" : "productos"}`}
              />
            </View>
          </BloqueAnimado>

          <Seccion
            titulo="Altas, últimos 14 días"
            pie={`${num(r.altas_por_dia.reduce((a, d) => a + d.altas, 0))} cuentas en 14 días · ${num(r.nuevas_30d)} en 30.`}
            style={entrada(3)}
          >
            <Tarjeta style={s.grafico}>
              <Altas dias={r.altas_por_dia} />
            </Tarjeta>
          </Seccion>

          {(r.por_plan ?? []).length ? (
            <Seccion titulo="Cuentas por plan" style={entrada(4)}>
              <PlanesBarra planes={r.por_plan} />
            </Seccion>
          ) : null}

          <Seccion titulo="En la plataforma" style={entrada(5)}>
            <Tarjeta>
              <FilaDato etiqueta="Categorías" valor={r.categorias} />
              <Separador />
              <FilaDato etiqueta="Invitaciones pendientes" valor={r.invitaciones} />
            </Tarjeta>
          </Seccion>
        </>
      ) : null}
    </Vista>
  );
}

/** Bloque sin título que entra con la misma animación que las secciones. */
function BloqueAnimado({
  children,
  style,
}: {
  children: React.ReactNode;
  style: Parameters<typeof Seccion>[0]["style"];
}) {
  return <Seccion style={style}>{children}</Seccion>;
}

function FilaDato({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  const t = useTema();
  return (
    <View style={s.filaDato}>
      <Text style={[tipo.cuerpo, { color: t.texto }]}>{etiqueta}</Text>
      <Text style={[tipo.cuerpo, { color: t.textoSec, fontVariant: ["tabular-nums"] }]}>
        {num(valor)}
      </Text>
    </View>
  );
}

/** Una cuenta cerca de su límite: quién, dónde, y una barra de cuánto lleva. */
function FilaLimite({ c, onPress }: { c: CercaDelLimite; onPress: () => void }) {
  const t = useTema();
  const lleno = c.usados >= c.max;
  const color = lleno ? t.rojo : t.tinte;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.nombre}, ${textoCerca(c)}`}
      onPress={onPress}
      style={({ pressed }) => [s.filaLimite, pressed && { backgroundColor: t.relleno }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={1}>
          {c.nombre} · {c.plan}
        </Text>
        <Text style={[tipo.nota, { color }]} numberOfLines={1}>
          {textoCerca(c)}
        </Text>
        <View style={[s.pista, { backgroundColor: t.relleno }]}>
          <View
            style={[
              s.relleno,
              { backgroundColor: color, width: `${Math.min(100, (c.usados / c.max) * 100)}%` },
            ]}
          />
        </View>
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
  sub: { fontSize: 12 },
  grafico: { padding: 16 },
  barras: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 72 },
  barraCol: { flex: 1, justifyContent: "flex-end" },
  barra: { borderRadius: 4 },
  eje: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  partida: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 },
  leyenda: { flexDirection: "row", alignItems: "center", gap: 10 },
  punto: { width: 10, height: 10, borderRadius: 5 },
  aviso: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, padding: 14 },
  filaLimite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pista: { height: 5, borderRadius: 3, overflow: "hidden" },
  relleno: { height: 5, borderRadius: 3 },
  filaDato: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 16,
  },
});
