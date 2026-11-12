import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { planes as planesApi } from "@/api";
import { TarjetaPlan } from "@/components/TarjetaPlan";
import { BotonCabecera, BotonPrincipal, CampoFila, Contenido, Fila, Grupo } from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { useMiPedido, useMiPlan } from "@/lib/miPlan";
import { tipo, useTema } from "@/lib/theme";

/** El owner elige otro plan y se lo pide al admin (todavía no hay cobro). */
export default function PedirPlan() {
  const t = useTema();
  const qc = useQueryClient();
  const { data: actual } = useMiPlan();
  const { data: pedido } = useMiPedido();
  const { data: planes, isLoading } = useQuery({
    queryKey: ["planes", "disponibles"],
    queryFn: planesApi.disponibles,
  });
  const [elegido, setElegido] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seleccion = elegido ?? pedido?.plan_id ?? null;

  async function enviar() {
    if (!seleccion || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await planesApi.pedir(seleccion, motivo);
      await qc.invalidateQueries({ queryKey: ["miPedido"] });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  function cancelar() {
    confirmar(
      "¿Cancelar el pedido?",
      "Vas a poder hacer otro cuando quieras.",
      "Cancelar pedido",
      () =>
        void planesApi
          .cancelarPedido()
          .then(() => qc.invalidateQueries({ queryKey: ["miPedido"] }))
          .then(() => router.back())
          .catch((e: Error) => setError(e.message)),
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Cambiar de plan",
          headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}

        {pedido ? (
          <Grupo
            titulo="Pedido enviado"
            pie={`Pediste el plan ${pedido.plan}. Te avisamos cuando el admin lo revise: vas a ver el cambio en tu perfil. Si eliges otro plan, reemplaza este pedido.`}
          >
            <Fila titulo={`Plan ${pedido.plan}`} subtitulo="Esperando respuesta" />
            <Fila titulo="Cancelar el pedido" destructiva onPress={cancelar} />
          </Grupo>
        ) : null}

        {planes ? (
          <View style={{ gap: 12, marginBottom: 8 }}>
            {/* Mismo orden que el admin les dio; el actual queda a la vista para comparar. */}
            {planes.map((p) =>
              p.id === actual?.id ? (
                <TarjetaPlan key={p.id} plan={p} actual />
              ) : (
                <TarjetaPlan
                  key={p.id}
                  plan={p}
                  elegida={seleccion === p.id}
                  pedida={pedido?.plan_id === p.id}
                  onPress={() => setElegido(p.id)}
                />
              ),
            )}
            <Text style={[tipo.nota, { color: t.textoSec, paddingHorizontal: 16 }]}>
              Todavía no hay cobro en la app: el admin revisa el pedido y te cambia el plan.
            </Text>
          </View>
        ) : null}

        <Grupo titulo="Motivo" pie="Opcional. Ayuda al admin a decidir.">
          <CampoFila
            placeholder="Por ejemplo: sumamos una sucursal"
            value={motivo}
            onChangeText={setMotivo}
            maxLength={300}
          />
        </Grupo>

        {error ? (
          <Text style={[tipo.nota, { color: t.rojo, paddingHorizontal: 16 }]}>{error}</Text>
        ) : null}

        <BotonPrincipal onPress={enviar} deshabilitado={!seleccion} cargando={enviando}>
          {pedido && seleccion !== pedido.plan_id
            ? "Reemplazar el pedido"
            : `Pedir ${planes?.find((p) => p.id === seleccion)?.nombre ?? "este plan"}`}
        </BotonPrincipal>
      </Contenido>
    </>
  );
}
