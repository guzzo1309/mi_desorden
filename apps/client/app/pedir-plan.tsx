import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Text } from "react-native";
import { planes as planesApi } from "@/api";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { useMiPedido, useMiPlan } from "@/lib/miPlan";
import { resumenLimites, textoPrecio } from "@/lib/planes";
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

  const opciones = (planes ?? []).filter((p) => p.id !== actual?.id);
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
          <Grupo
            titulo={`Tu plan actual: ${actual?.nombre ?? "—"}`}
            pie="Todavía no hay cobro en la app: el admin revisa el pedido y te cambia el plan."
          >
            {opciones.map((p) => (
              <Fila
                key={p.id}
                titulo={`${p.nombre}  ·  ${textoPrecio(p.precio_mensual)}`}
                subtitulo={resumenLimites(p)}
                onPress={() => setElegido(p.id)}
                derecha={
                  seleccion === p.id ? (
                    <Icono
                      sf="checkmark"
                      ion="checkmark"
                      size={18}
                      color={t.tinte}
                      weight="semibold"
                    />
                  ) : undefined
                }
              />
            ))}
          </Grupo>
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
          {pedido ? "Reemplazar el pedido" : "Pedir este plan"}
        </BotonPrincipal>
      </Contenido>
    </>
  );
}
