import type { Periodo, Plan } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { planes as planesApi } from "@/api";
import { TarjetaPlan } from "@/components/TarjetaPlan";
import { BotonCabecera, Contenido, tocar } from "@/components/ui";
import { useMiPlan } from "@/lib/miPlan";
import { dinero, mayorAhorro, precioDe } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" });

/**
 * Comprar un plan, mensual o anual (el anual con descuento). Es una compra de
 * prueba: no se pide tarjeta ni se cobra nada. El plan cambia al instante y la
 * compra le aparece al admin en sus ingresos.
 */
export default function ComprarPlan() {
  const t = useTema();
  const qc = useQueryClient();
  const { data: actual } = useMiPlan({ fresco: true });
  const { data: planes, isLoading } = useQuery({
    queryKey: ["planes", "disponibles"],
    queryFn: planesApi.disponibles,
  });
  const [periodo, setPeriodo] = useState<Periodo>("anual");
  const [elegido, setElegido] = useState<string | null>(null);
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ahorro = planes ? mayorAhorro(planes) : null;
  const plan = planes?.find((p) => p.id === elegido) ?? null;
  const precio = plan ? precioDe(plan, periodo) : null;

  /** ¿Es lo que ya tengo? Los gratis no tienen período. */
  const esActual = (p: Plan) => {
    if (p.id !== actual?.id) return false;
    const gratis = !precioDe(p, periodo);
    return gratis || (actual.periodo ?? null) === periodo;
  };
  const puedeConfirmar = !!plan && precio !== null && !esActual(plan) && !comprando;

  async function comprar() {
    if (!plan || !puedeConfirmar) return;
    setComprando(true);
    setError(null);
    try {
      const r = await planesApi.comprar(plan.id, periodo);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["miPlan"] }),
        qc.invalidateQueries({ queryKey: ["limites"] }),
        qc.invalidateQueries({ queryKey: ["miPedido"] }),
      ]);
      const detalle = r.vence_en
        ? `Ya tienes el plan ${r.plan}. Se renueva el ${fechaLarga(r.vence_en)}.`
        : `Ya tienes el plan ${r.plan}.`;
      if (Platform.OS === "web") router.back();
      else Alert.alert("¡Listo!", detalle, [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      setError((e as Error).message);
      setComprando(false);
    }
  }

  function confirmar() {
    if (!plan || !puedeConfirmar || precio === null) return;
    const que =
      precio === 0
        ? `Cambias al plan ${plan.nombre}, que es gratis.`
        : `Plan ${plan.nombre} ${periodo === "anual" ? "anual" : "mensual"} por ${dinero(precio)}.`;
    const mensaje = `${que} Es una compra de prueba: no se cobra nada y el plan cambia al instante.`;
    if (Platform.OS === "web") {
      void comprar();
      return;
    }
    Alert.alert(precio === 0 ? "¿Cambiar de plan?" : "¿Confirmar la compra?", mensaje, [
      { text: "Cancelar", style: "cancel" },
      { text: precio === 0 ? "Cambiar" : "Comprar", onPress: () => void comprar() },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Cambiar de plan",
          headerLeft: () => <BotonCabecera texto="Volver" atras onPress={() => router.back()} />,
          headerRight: () =>
            comprando ? (
              <ActivityIndicator style={{ paddingHorizontal: 16 }} />
            ) : (
              <BotonCabecera
                texto="Confirmar"
                fuerte
                apagado={!puedeConfirmar}
                onPress={confirmar}
              />
            ),
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {/* Mensual / Anual */}
        <View style={[s.selector, { backgroundColor: t.relleno }]} accessibilityRole="tablist">
          {(["mensual", "anual"] as const).map((p) => {
            const activo = periodo === p;
            return (
              <Pressable
                key={p}
                accessibilityRole="tab"
                accessibilityState={{ selected: activo }}
                onPress={() => (tocar(), setPeriodo(p))}
                style={[s.opcion, activo && { backgroundColor: t.celda }]}
              >
                <Text
                  style={[tipo.subtitulo, { color: t.texto, fontWeight: activo ? "600" : "400" }]}
                >
                  {p === "mensual" ? "Mensual" : "Anual"}
                </Text>
                {p === "anual" && ahorro ? (
                  <View style={[s.ahorro, { backgroundColor: `${t.verde}26` }]}>
                    <Text style={[tipo.leyenda, { color: t.verde, fontWeight: "700" }]}>
                      −{ahorro} %
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {actual?.vence_en ? (
          <Text style={[tipo.nota, { color: t.textoSec, paddingHorizontal: 16 }]}>
            Tienes {actual.nombre} {actual.periodo === "anual" ? "anual" : "mensual"}: se renueva el{" "}
            {fechaLarga(actual.vence_en)}.
          </Text>
        ) : null}

        {isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}

        {planes ? (
          <View style={{ gap: 12 }}>
            {/* Mismo orden que el admin les dio; el actual queda a la vista para comparar. */}
            {planes.map((p, i) =>
              esActual(p) ? (
                <TarjetaPlan key={p.id} plan={p} nivel={i} periodo={periodo} actual />
              ) : (
                <TarjetaPlan
                  key={p.id}
                  plan={p}
                  nivel={i}
                  periodo={periodo}
                  elegida={elegido === p.id}
                  onPress={() => (setElegido(p.id), setError(null))}
                />
              ),
            )}
          </View>
        ) : null}

        {error ? (
          <Text style={[tipo.nota, { color: t.rojo, paddingHorizontal: 16 }]}>{error}</Text>
        ) : null}

        <Text style={[tipo.nota, { color: t.textoSec, paddingHorizontal: 16 }]}>
          Elige un plan y toca Confirmar. Es una compra de prueba: no se pide tarjeta ni se cobra
          nada, y el plan cambia al instante.
        </Text>
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  selector: { flexDirection: "row", borderRadius: 14, padding: 3, gap: 3 },
  opcion: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    borderRadius: 11,
  },
  ahorro: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
});
