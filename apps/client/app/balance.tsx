import type { FiltroBalance } from "@mi-desorden/core";
import { useQuery } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { admin, mensajeError } from "@/api";
import {
  BotonCabecera,
  BotonPrincipal,
  Contenido,
  Fila,
  Grupo,
  Icono,
  Segmentado,
  tocar,
  Vacio,
} from "@/components/ui";
import {
  cambiarNivel,
  entero,
  esFuturo,
  etiquetaPeriodo,
  filtroDeHoy,
  moneda,
  moverPeriodo,
  nivelDe,
  nombreArchivo,
  pdfBalance,
  type NivelBalance,
} from "@/lib/balance";
import { guardarPdf } from "@/lib/guardarPdf";
import { useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

const NIVELES: { valor: NivelBalance; etiqueta: string }[] = [
  { valor: "anio", etiqueta: "Año" },
  { valor: "mes", etiqueta: "Mes" },
  { valor: "dia", etiqueta: "Día" },
];

const mismoFiltro = (a: FiltroBalance, b: FiltroBalance) =>
  a.anio === b.anio && a.mes === b.mes && a.dia === b.dia;

/**
 * Balance administrativo (solo el admin de la plataforma): elige año, mes o día,
 * ve las ganancias de ese período y las descarga en PDF. El PDF se arma con los
 * mismos datos que se ven acá.
 */
export default function Balance() {
  const t = useTema();
  const { esAdmin, cargandoRol } = useSesion();
  const [filtro, setFiltro] = useState<FiltroBalance>(() => filtroDeHoy("mes"));
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin", "balance", filtro.anio, filtro.mes, filtro.dia],
    queryFn: () => admin.balance(filtro),
    enabled: esAdmin,
    placeholderData: (previo) => previo,
  });
  const b = q.data;
  // Mientras llega el período nuevo se sigue viendo el anterior: no se descarga ese.
  const alDia = !!b && !q.isPlaceholderData && mismoFiltro(b.filtro, filtro);
  const siguienteFuturo = esFuturo(moverPeriodo(filtro, 1));

  const cambiar = (f: FiltroBalance) => {
    setFiltro(f);
    setError(null);
    setListo(null);
  };

  async function descargar() {
    if (!b || !alDia) return;
    setDescargando(true);
    setError(null);
    setListo(null);
    try {
      const nombre = nombreArchivo(b.filtro);
      await guardarPdf(pdfBalance(b), nombre);
      setListo(nombre);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setDescargando(false);
    }
  }

  const cabecera = (
    <Stack.Screen
      options={{
        title: "Balance",
        headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
      }}
    />
  );

  if (cargandoRol) return <ActivityIndicator style={{ marginTop: 48 }} />;
  if (!esAdmin) {
    return (
      <>
        {cabecera}
        <Vacio
          sf="lock.fill"
          ion="lock-closed"
          titulo="Solo para el admin"
          texto="El balance administrativo lo ve únicamente el admin de MI DESORDEN."
        />
      </>
    );
  }

  const cortado = b && b.detalle_total > b.detalle.length;

  return (
    <>
      {cabecera}
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <Grupo titulo="Período">
          <View style={s.selector}>
            <Segmentado
              opciones={NIVELES}
              valor={nivelDe(filtro)}
              onCambio={(n) => cambiar(cambiarNivel(filtro, n))}
            />
            <View style={s.periodo}>
              <Flecha
                sf="chevron.left"
                ion="chevron-back"
                etiqueta="Período anterior"
                onPress={() => cambiar(moverPeriodo(filtro, -1))}
              />
              <Text
                style={[tipo.destacado, { color: t.texto, flex: 1, textAlign: "center" }]}
                numberOfLines={1}
                accessibilityRole="header"
              >
                {etiquetaPeriodo(filtro)}
              </Text>
              <Flecha
                sf="chevron.right"
                ion="chevron-forward"
                etiqueta="Período siguiente"
                deshabilitada={siguienteFuturo}
                onPress={() => cambiar(moverPeriodo(filtro, 1))}
              />
            </View>
          </View>
        </Grupo>

        {q.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} /> : null}
        {q.error && !b ? (
          <Vacio
            sf="wifi.exclamationmark"
            ion="cloud-offline-outline"
            titulo="No se pudo cargar"
            texto={mensajeError(q.error)}
          />
        ) : null}

        {b ? (
          <View style={{ opacity: alDia ? 1 : 0.5 }}>
            <Grupo
              titulo="Ganancias"
              pie={
                b.cobros
                  ? `De ${entero(b.cuentas)} ${b.cuentas === 1 ? "cuenta" : "cuentas"} con plan pago.`
                  : "No hubo cobros de planes pagos en este período."
              }
            >
              <Fila titulo="Total" valor={moneda(b.total)} />
              <Fila titulo="Cobros" valor={entero(b.cobros)} />
            </Grupo>

            {b.por_plan.length ? (
              <Grupo titulo="Por plan">
                {b.por_plan.map((p) => (
                  <Fila
                    key={p.codigo}
                    titulo={p.plan}
                    subtitulo={`${entero(p.cobros)} ${p.cobros === 1 ? "cobro" : "cobros"}`}
                    valor={moneda(p.total)}
                  />
                ))}
              </Grupo>
            ) : null}

            <View style={{ gap: 10 }}>
              <BotonPrincipal
                onPress={descargar}
                cargando={descargando}
                deshabilitado={!alDia || q.isFetching}
              >
                Descargar PDF
              </BotonPrincipal>
              <Text style={[tipo.nota, s.centro, { color: error ? t.rojo : t.textoSec }]}>
                {error ??
                  (listo
                    ? `Listo: ${listo}`
                    : cortado
                      ? `El PDF lista los primeros ${entero(b.detalle.length)} cobros de ${entero(b.detalle_total)}; los totales incluyen todos.`
                      : "Incluye los totales, el desglose por plan y cada cobro del período.")}
              </Text>
            </View>
          </View>
        ) : null}
      </Contenido>
    </>
  );
}

function Flecha({
  sf,
  ion,
  etiqueta,
  onPress,
  deshabilitada,
}: {
  sf: "chevron.left" | "chevron.right";
  ion: "chevron-back" | "chevron-forward";
  etiqueta: string;
  onPress: () => void;
  deshabilitada?: boolean;
}) {
  const t = useTema();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ disabled: !!deshabilitada }}
      disabled={deshabilitada}
      hitSlop={8}
      onPress={() => (tocar(), onPress())}
      style={({ pressed }) => [
        s.flecha,
        { backgroundColor: t.relleno, opacity: deshabilitada ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icono sf={sf} ion={ion} size={15} color={t.tinte} weight="semibold" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  selector: { padding: 12, gap: 14 },
  periodo: { flexDirection: "row", alignItems: "center", gap: 12 },
  flecha: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  centro: { textAlign: "center", paddingHorizontal: 16 },
});