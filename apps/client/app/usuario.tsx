import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { admin, mensajeError } from "@/api";
import {
  Avatar,
  BotonCabecera,
  BotonPrincipal,
  Contenido,
  Fila,
  Grupo,
  Icono,
  Vacio,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { fechaCorta, haceCuanto } from "@/lib/fecha";
import { resumenLimites } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

/** Detalle de una cuenta para el admin: plan, inventarios (sin su contenido) y suspensión. */
export default function UsuarioDetalle() {
  const t = useTema();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useQuery({
    queryKey: ["admin", "usuario", id],
    queryFn: () => admin.usuarioDetalle(id),
    enabled: !!id,
  });
  const planesQ = useQuery({ queryKey: ["admin", "planes"], queryFn: admin.planes });
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const u = q.data;

  /** Corre una acción del admin y refresca todo lo que la muestra. */
  async function hacer(accion: () => Promise<void>) {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      await Promise.all([qc.invalidateQueries({ queryKey: ["admin"] })]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  function alternarSuspension() {
    if (!u) return;
    if (u.suspendido) {
      void hacer(() => admin.suspender(u.id, false));
      return;
    }
    confirmar(
      `¿Suspender a ${u.nombre}?`,
      "No va a poder iniciar sesión y se le cierran las sesiones abiertas. Puede tardar hasta una hora en perder el acceso que ya tiene. Sus datos no se borran y puedes reactivarla cuando quieras.",
      "Suspender",
      () => void hacer(() => admin.suspender(u.id, true)),
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: "Cuenta",
          headerLeft: () => <BotonCabecera texto="Cerrar" onPress={() => router.back()} />,
        }}
      />
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {q.isLoading ? <ActivityIndicator style={{ marginTop: 32 }} /> : null}
        {q.error && !u ? (
          <Vacio
            sf="wifi.exclamationmark"
            ion="cloud-offline-outline"
            titulo="No se pudo cargar"
            texto={mensajeError(q.error)}
          />
        ) : null}

        {u ? (
          <>
            <View style={s.heroe}>
              <Avatar nombre={u.nombre} tam={72} />
              <Text style={[tipo.titulo2, { color: t.texto }]}>{u.nombre}</Text>
              <Text style={[tipo.subtitulo, { color: t.textoSec }]}>{u.email}</Text>
              {u.suspendido ? (
                <Text style={[tipo.nota, s.suspendida, { backgroundColor: t.rojo }]}>
                  Cuenta suspendida
                </Text>
              ) : null}
            </View>

            <Grupo titulo="Cuenta">
              <Fila titulo="Registro" valor={fechaCorta(u.creado_en)} />
              <Fila
                titulo="Último acceso"
                valor={u.ultimo_acceso ? haceCuanto(u.ultimo_acceso) : "Nunca"}
              />
              <Fila titulo="Miembro en inventarios de otros" valor={String(u.inventarios_ajenos)} />
            </Grupo>

            <Grupo
              titulo="Plan"
              pie="Cambiar el plan no borra nada: si la cuenta ya pasa el nuevo límite, solo se le frenan las altas nuevas."
            >
              {(planesQ.data ?? [])
                .filter((p) => p.activo || p.id === u.plan.id)
                .map((p) => {
                  const actual = p.id === u.plan.id;
                  return (
                    <Fila
                      key={p.id}
                      titulo={p.nombre}
                      subtitulo={resumenLimites(p)}
                      apagada={trabajando}
                      // Mientras se cambia el plan no se acepta otro toque, y cada cambio se confirma:
                      // un segundo toque sin querer devolvía la cuenta al plan anterior.
                      onPress={
                        actual || trabajando
                          ? undefined
                          : () =>
                              confirmar(
                                `¿Pasar a ${u.nombre} al plan ${p.nombre}?`,
                                `${resumenLimites(p)}. No se borra nada: si la cuenta ya pasa un límite, solo se le frenan las altas nuevas.`,
                                "Cambiar plan",
                                () => void hacer(() => admin.asignarPlan(u.id, p.id)),
                              )
                      }
                      derecha={
                        actual ? (
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
                  );
                })}
            </Grupo>

            <Grupo
              titulo={`Inventarios que creó (${u.inventarios.length})`}
              pie="Solo se ven los totales: el contenido de los inventarios es privado."
            >
              {u.inventarios.length ? (
                u.inventarios.map((inv) => (
                  <Fila
                    key={inv.id}
                    titulo={inv.nombre}
                    subtitulo={`${inv.productos} ${inv.productos === 1 ? "producto" : "productos"} · ${inv.personas} ${inv.personas === 1 ? "persona" : "personas"}`}
                  />
                ))
              ) : (
                <Fila titulo="Todavía no creó ninguno" apagada />
              )}
            </Grupo>

            <Grupo titulo="Historial de planes">
              {u.historial_planes.map((h, i) => (
                <Fila
                  key={`${h.plan}-${i}`}
                  titulo={h.plan}
                  valor={`${fechaCorta(h.desde)}${h.hasta ? ` – ${fechaCorta(h.hasta)}` : " · vigente"}`}
                />
              ))}
            </Grupo>

            {error ? (
              <Text style={[tipo.nota, { color: t.rojo, paddingHorizontal: 16 }]}>{error}</Text>
            ) : null}

            {u.es_admin ? null : (
              <BotonPrincipal
                variante={u.suspendido ? "gris" : "destructivo"}
                cargando={trabajando}
                onPress={alternarSuspension}
              >
                {u.suspendido ? "Reactivar cuenta" : "Suspender cuenta"}
              </BotonPrincipal>
            )}
          </>
        ) : null}
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  heroe: { alignItems: "center", gap: 4, paddingVertical: 8 },
  suspendida: {
    marginTop: 6,
    color: "#fff",
    fontWeight: "600",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
