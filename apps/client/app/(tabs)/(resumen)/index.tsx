import type { AdminResumen, Ingresos } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { diaMes, haceCuanto } from "@/lib/fecha";
import { agruparCerca, type CuentaCerca, dinero, textoCerca } from "@/lib/planes";
import { porcentaje } from "@/lib/resumen";
import { tipo, useTema, fuenteMarca } from "@/lib/theme";

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
        style={[s.valor, { color: destacado ? t.sobreTinte : t.texto }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {num(valor)}
      </Text>
      <Text
        style={[tipo.nota, { color: destacado ? t.sobreTinte : t.texto, fontWeight: "600" }]}
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
function PlanesBarra({
  planes,
  ingresos,
}: {
  planes: AdminResumen["por_plan"];
  ingresos?: Ingresos["por_plan"];
}) {
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
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[tipo.cuerpo, { color: t.texto }]}>{p.nombre}</Text>
              {ingresos?.find((x) => x.plan === p.nombre) ? (
                <Text style={[tipo.nota, { color: t.verde }]}>
                  {dinero(Number(ingresos.find((x) => x.plan === p.nombre)!.monto))} ganados
                </Text>
              ) : null}
            </View>
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
  const entrada = useEntrada(7);
  const q = useQuery({ queryKey: ["admin", "resumen"], queryFn: admin.resumen });
  const r = q.data;
  const cuentasCerca = agruparCerca(r?.cerca_limite ?? []);
  const [verTodas, setVerTodas] = useState(false);
  const visibles = verTodas ? cuentasCerca : cuentasCerca.slice(0, 4);

  const abrirCuenta = (id: string) => {
    tocar();
    router.push({ pathname: "/usuario", params: { id } });
  };

  const actualizado = q.dataUpdatedAt
    ? ` · actualizado ${haceCuanto(new Date(q.dataUpdatedAt).toISOString())}`
    : "";

  return (
    <Vista
      titulo="Resumen"
      refreshControl={
        <RefreshControl
          refreshing={q.isRefetching}
          onRefresh={() => void q.refetch()}
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
          {/* Lo que más pesa: la plata */}
          {r.ingresos ? (
            <BloqueAnimado style={entrada(1)}>
              <HeroIngresos ingresos={r.ingresos} />
            </BloqueAnimado>
          ) : null}

          {/* La plataforma en tres números */}
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

          {r.ingresos?.ultimas.length ? (
            <Seccion titulo="Últimas compras" style={entrada(3)}>
              <Tarjeta>
                {r.ingresos.ultimas.map((c, i) => (
                  <View key={`${c.creado_en}-${i}`}>
                    {i > 0 ? <Separador sangria={16 + 36 + 12} /> : null}
                    <FilaCompra
                      compra={c}
                      onPress={c.usuario_id ? () => abrirCuenta(c.usuario_id!) : undefined}
                    />
                  </View>
                ))}
              </Tarjeta>
            </Seccion>
          ) : null}

          {(r.por_plan ?? []).length ? (
            <Seccion titulo="Cuentas por plan" style={entrada(4)}>
              <PlanesBarra planes={r.por_plan} ingresos={r.ingresos?.por_plan} />
            </Seccion>
          ) : null}

          {cuentasCerca.length ? (
            <Seccion
              titulo="Cerca del límite"
              derecha={
                <Text style={[tipo.subtitulo, { color: t.textoSec }]}>{cuentasCerca.length}</Text>
              }
              pie="Cuentas al 80 % o más de su plan: las que más probablemente compren uno mejor."
              style={entrada(5)}
            >
              <Tarjeta>
                {visibles.map((c, i) => (
                  <View key={c.usuario_id}>
                    {i > 0 ? <Separador /> : null}
                    <FilaCuentaCerca c={c} onPress={() => abrirCuenta(c.usuario_id)} />
                  </View>
                ))}
                {cuentasCerca.length > 4 ? (
                  <>
                    <Separador />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => (tocar(), setVerTodas((v) => !v))}
                      style={({ pressed }) => [
                        s.filaDato,
                        { justifyContent: "center" },
                        pressed && { backgroundColor: t.relleno },
                      ]}
                    >
                      <Text style={[tipo.cuerpo, { color: t.tinte }]}>
                        {verTodas ? "Ver menos" : `Ver las ${cuentasCerca.length}`}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </Tarjeta>
            </Seccion>
          ) : null}

          <Seccion
            titulo="Altas, últimos 14 días"
            pie={`${num(r.altas_por_dia.reduce((a, d) => a + d.altas, 0))} cuentas en 14 días · ${num(r.nuevas_30d)} en 30.`}
            style={entrada(6)}
          >
            <Tarjeta style={s.grafico}>
              <Altas dias={r.altas_por_dia} />
            </Tarjeta>
          </Seccion>

          <Seccion titulo="En la plataforma" style={entrada(6)}>
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

/** Obsidiana con dorado, como la tarjeta del plan más alto. */
const HERO_FONDO = "linear-gradient(135deg, #34343a 0%, #141416 50%, #050506 100%)";
const HERO_BRILLO =
  "linear-gradient(115deg, rgba(255,255,255,0) 25%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0) 58%)";
const ORO = "#D6B26E";
const MARFIL = "#F3E2BC";
const LETRA = Platform.select({ ios: "Avenir Next", default: undefined });

/** Lo ganado, grande, con el mes, los 30 días y lo recurrente debajo. */
function HeroIngresos({ ingresos }: { ingresos: Ingresos }) {
  const mini = [
    { etiqueta: "ESTE MES", monto: ingresos.mes_actual },
    { etiqueta: "30 DÍAS", monto: ingresos.ultimos_30d },
    { etiqueta: "AL MES", monto: ingresos.recurrente_mensual },
  ];
  return (
    <View
      style={[s.hero, { backgroundImage: HERO_FONDO }]}
      accessible
      accessibilityLabel={`Ingresos: ${dinero(Number(ingresos.total))} en total. Este mes ${dinero(Number(ingresos.mes_actual))}. Recurrente por mes ${dinero(Number(ingresos.recurrente_mensual))}.`}
    >
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundImage: HERO_BRILLO }]}
      />
      <View style={s.heroCabeza}>
        <Text style={[s.heroEtiqueta, { color: ORO }]}>INGRESOS</Text>
        <Text style={[s.heroNota, { color: MARFIL }]}>
          {num(ingresos.compras)} {ingresos.compras === 1 ? "compra" : "compras"}
        </Text>
      </View>
      <Text style={[s.heroTotal, { color: MARFIL }]} numberOfLines={1} adjustsFontSizeToFit>
        {dinero(Number(ingresos.total))}
      </Text>
      <Text style={[s.heroNota, { color: MARFIL, marginTop: -4 }]}>ganado en total</Text>
      <View style={[s.heroLinea, { backgroundColor: `${ORO}55` }]} />
      <View style={s.fila}>
        {mini.map((m) => (
          <View key={m.etiqueta} style={{ flex: 1, gap: 2 }}>
            <Text style={[s.heroMiniEtiqueta, { color: ORO }]}>{m.etiqueta}</Text>
            <Text style={[s.heroMini, { color: MARFIL }]} numberOfLines={1} adjustsFontSizeToFit>
              {dinero(Number(m.monto))}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Una compra: quién, qué plan y cuánto. */
function FilaCompra({
  compra,
  onPress,
}: {
  compra: Ingresos["ultimas"][number];
  onPress?: () => void;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [s.filaLimite, pressed && { backgroundColor: t.relleno }]}
    >
      <View style={[s.moneda, { backgroundColor: `${t.verde}22` }]}>
        <Icono sf="arrow.down.left" ion="arrow-down" size={15} color={t.verde} weight="semibold" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text style={[tipo.cuerpo, { color: t.texto }]} numberOfLines={1}>
          {compra.nombre}
        </Text>
        <Text style={[tipo.nota, { color: t.textoSec }]} numberOfLines={1}>
          {compra.plan} {compra.periodo} · {haceCuanto(compra.creado_en)}
        </Text>
      </View>
      <Text
        style={[tipo.cuerpo, { color: t.verde, fontWeight: "700", fontVariant: ["tabular-nums"] }]}
      >
        +{dinero(Number(compra.monto))}
      </Text>
    </Pressable>
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

/** Una cuenta cerca de su límite: quién, su plan y una línea por cada recurso casi lleno. */
function FilaCuentaCerca({ c, onPress }: { c: CuentaCerca; onPress: () => void }) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${c.nombre}, plan ${c.plan}: ${c.recursos.map(textoCerca).join(", ")}`}
      onPress={onPress}
      style={({ pressed }) => [s.filaLimite, pressed && { backgroundColor: t.relleno }]}
    >
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={s.nombreCerca}>
          <Text style={[tipo.destacado, { color: t.texto, flexShrink: 1 }]} numberOfLines={1}>
            {c.nombre}
          </Text>
          <View style={[s.chipPlan, { backgroundColor: t.relleno }]}>
            <Text style={[tipo.leyenda, { color: t.textoSec, fontWeight: "600" }]}>{c.plan}</Text>
          </View>
        </View>
        {c.recursos.map((x) => {
          const lleno = x.usados >= x.max;
          const color = lleno ? t.rojo : t.tinte;
          return (
            <View key={`${x.recurso}-${x.inventario ?? ""}`} style={{ gap: 3 }}>
              <Text style={[tipo.nota, { color }]} numberOfLines={1}>
                {textoCerca(x)}
              </Text>
              <View style={[s.pista, { backgroundColor: t.relleno }]}>
                <View
                  style={[
                    s.relleno,
                    {
                      backgroundColor: color,
                      width: `${Math.min(100, (x.usados / x.max) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
          );
        })}
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
  hero: {
    borderRadius: 26,
    padding: 22,
    gap: 8,
    overflow: "hidden",
    boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
  },
  heroCabeza: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroEtiqueta: { fontFamily: LETRA, fontSize: 12, fontWeight: "700", letterSpacing: 3 },
  heroNota: { fontFamily: LETRA, fontSize: 13, opacity: 0.75 },
  heroTotal: {
    fontFamily: LETRA,
    fontSize: 48,
    fontWeight: "700",
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
    marginTop: 6,
  },
  heroLinea: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
  heroMiniEtiqueta: { fontFamily: LETRA, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  heroMini: { fontFamily: LETRA, fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
  moneda: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  nombreCerca: { flexDirection: "row", alignItems: "center", gap: 8 },
  chipPlan: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 },
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
  valor: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: fuenteMarca,
    letterSpacing: -0.5,
    fontVariant: ["tabular-nums"],
  },
  sub: { fontSize: 12 },
  grafico: { padding: 16 },
  barras: { flexDirection: "row", alignItems: "flex-end", gap: 4, height: 72 },
  barraCol: { flex: 1, justifyContent: "flex-end" },
  barra: { borderRadius: 4 },
  eje: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  partida: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", gap: 2 },
  leyenda: { flexDirection: "row", alignItems: "center", gap: 10 },
  punto: { width: 10, height: 10, borderRadius: 5 },
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
