import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { type ComponentProps, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { admin, mensajeError } from "@/api";
import { AvatarPerfil } from "@/components/AvatarPerfil";
import { metalDe, MiniTarjeta } from "@/components/TarjetaPlan";
import {
  Avatar,
  BotonCabecera,
  BotonPrincipal,
  Contenido,
  Fila,
  Grupo,
  Icono,
  tocar,
  Vacio,
} from "@/components/ui";
import { confirmar } from "@/lib/confirmar";
import { fechaCorta, haceCuanto } from "@/lib/fecha";
import { numeroWhatsApp } from "@/lib/perfil";
import { resumenLimites, textoPrecio } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

/**
 * Detalle de una cuenta para el admin: quién es, cómo usa la app, su plan (se elige
 * abajo y se aplica con Guardar), sus inventarios (sin el contenido) y la suspensión.
 */
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
  // La foto y el teléfono vienen en la lista de cuentas (el detalle no los trae).
  const { data: cuentas } = useQuery({ queryKey: ["admin", "usuarios"], queryFn: admin.usuarios });
  const cuenta = cuentas?.find((c) => c.id === id);
  const avatar = cuenta?.avatar_path ?? null;
  const telefono = cuenta?.telefono?.trim() || null;
  const whatsapp = telefono ? numeroWhatsApp(telefono) : null;
  const [planElegido, setPlanElegido] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const u = q.data;

  const ordenados = [...(planesQ.data ?? [])].sort((a, b) => a.orden - b.orden);
  const nivelDe = (planId: string) =>
    Math.max(
      0,
      ordenados.findIndex((p) => p.id === planId),
    );
  const elegido = planElegido ?? u?.plan.id ?? null;
  const nuevoPlan =
    u && planElegido && planElegido !== u.plan.id
      ? ordenados.find((p) => p.id === planElegido)
      : undefined;

  /** Corre una acción del admin y refresca todo lo que la muestra. */
  async function hacer(accion: () => Promise<void>): Promise<boolean> {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      await qc.invalidateQueries({ queryKey: ["admin"] });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  function guardar() {
    if (!u || !nuevoPlan) return;
    confirmar(
      `¿Pasar a ${u.nombre} al plan ${nuevoPlan.nombre}?`,
      `${resumenLimites(nuevoPlan)}. No se borra nada: si la cuenta ya pasa un límite, solo se le frenan las altas nuevas.`,
      "Cambiar plan",
      () =>
        void hacer(() => admin.asignarPlan(u.id, nuevoPlan.id)).then((ok) => {
          if (ok) router.back();
        }),
    );
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

  const metal = u ? metalDe(nivelDe(u.plan.id)) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Cuenta",
          headerLeft: () => <BotonCabecera texto="Volver" atras onPress={() => router.back()} />,
          headerRight: () =>
            trabajando && nuevoPlan ? (
              <ActivityIndicator style={{ paddingHorizontal: 16 }} />
            ) : (
              <BotonCabecera texto="Guardar" fuerte apagado={!nuevoPlan} onPress={guardar} />
            ),
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

        {u && metal ? (
          <>
            {/* Quién es */}
            <View style={s.heroe}>
              <View style={[s.aro, { borderColor: metal.acento }]}>
                {avatar ? (
                  <AvatarPerfil nombre={u.nombre} ruta={avatar} tam={88} />
                ) : (
                  <Avatar nombre={u.nombre} tam={88} />
                )}
              </View>
              <Text
                style={[tipo.titulo2, { color: t.texto, fontSize: 26, marginTop: 6 }]}
                numberOfLines={1}
              >
                {u.nombre}
              </Text>
              <Text style={[tipo.subtitulo, { color: t.textoSec }]} numberOfLines={1}>
                {u.email}
              </Text>
              <View style={s.etiquetas}>
                <View style={[s.etiquetaPlan, { backgroundImage: metal.fondo }]}>
                  <Text style={[s.etiquetaPlanTexto, { color: metal.texto }]}>
                    {u.plan.nombre.toUpperCase()}
                  </Text>
                </View>
                {u.es_admin ? <Etiqueta texto="Admin" color={t.tinte} /> : null}
                {u.suspendido ? <Etiqueta texto="Suspendida" color={t.rojo} /> : null}
              </View>
            </View>

            {/* Contacto */}
            <View style={s.acciones}>
              <Accion
                sf="envelope.fill"
                ion="mail"
                texto="Correo"
                onPress={() => void Linking.openURL(`mailto:${u.email}`)}
              />
              <Accion
                sf="phone.fill"
                ion="call"
                texto="Llamar"
                // tel: solo acepta dígitos y +.
                onPress={
                  telefono
                    ? () => void Linking.openURL(`tel:${telefono.replace(/[^\d+]/g, "")}`)
                    : undefined
                }
              />
              <Accion
                sf="message.fill"
                ion="logo-whatsapp"
                texto="WhatsApp"
                color={WHATSAPP}
                // Abre el chat con un saludo ya escrito; si no tiene WhatsApp, wa.me lo avisa.
                onPress={
                  whatsapp
                    ? () =>
                        void Linking.openURL(
                          `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola ${u.nombre}, te escribo de Mi desorden.`)}`,
                        )
                    : undefined
                }
              />
            </View>

            {/* Cómo usa la app */}
            <View style={s.datos}>
              <Dato valor={String(u.inventarios.length)} etiqueta="Inventarios" />
              <Dato valor={String(u.inventarios_ajenos)} etiqueta="En otros" />
              <Dato
                valor={u.ultimo_acceso ? haceCuanto(u.ultimo_acceso) : "Nunca"}
                etiqueta="Último acceso"
              />
            </View>

            <Grupo titulo="Cuenta">
              <Fila titulo="Teléfono" valor={telefono ?? "Sin cargar"} />
              <Fila titulo="Registro" valor={fechaCorta(u.creado_en)} />
            </Grupo>

            <Grupo
              titulo="Plan"
              pie={
                nuevoPlan
                  ? `Toca Guardar para pasarla a ${nuevoPlan.nombre}. No se borra nada: si ya pasa un límite, solo se le frenan las altas nuevas.`
                  : "Elige otro plan y toca Guardar. Cambiarlo no borra nada."
              }
              sangria={74}
            >
              {ordenados
                .filter((p) => p.activo || p.id === u.plan.id)
                .map((p) => {
                  const marcado = p.id === elegido;
                  const actual = p.id === u.plan.id;
                  return (
                    <Fila
                      key={p.id}
                      titulo={actual ? `${p.nombre} · actual` : p.nombre}
                      subtitulo={`${textoPrecio(p.precio_mensual)} · ${resumenLimites(p)}`}
                      apagada={trabajando}
                      izquierda={<MiniTarjeta nivel={nivelDe(p.id)} />}
                      onPress={
                        trabajando
                          ? undefined
                          : () => setPlanElegido(p.id === u.plan.id ? null : p.id)
                      }
                      derecha={
                        <Icono
                          sf={marcado ? "checkmark.circle.fill" : "circle"}
                          ion={marcado ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={marcado ? t.tinte : t.textoTer}
                        />
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
                  subtitulo={`Desde ${fechaCorta(h.desde)}${h.hasta ? ` hasta ${fechaCorta(h.hasta)}` : ""}`}
                  derecha={h.hasta ? undefined : <Etiqueta texto="Vigente" color={t.verde} />}
                />
              ))}
            </Grupo>

            {error ? (
              <Text style={[tipo.nota, { color: t.rojo, paddingHorizontal: 16 }]}>{error}</Text>
            ) : null}

            {u.es_admin ? null : (
              <BotonPrincipal
                variante={u.suspendido ? "gris" : "destructivo"}
                cargando={trabajando && !nuevoPlan}
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

/** Verde de WhatsApp, para que el botón se reconozca de un vistazo. */
const WHATSAPP = "#25D366";

function Etiqueta({ texto, color }: { texto: string; color: string }) {
  return (
    <View style={[s.etiqueta, { backgroundColor: `${color}26` }]}>
      <Text style={[tipo.leyenda, { color, fontWeight: "700" }]}>{texto}</Text>
    </View>
  );
}

/** Botón de contacto, como en Contactos: ícono arriba, texto abajo. Sin dato, se apaga. */
function Accion({
  sf,
  ion,
  texto,
  color: colorPropio,
  onPress,
}: {
  sf: ComponentProps<typeof Icono>["sf"];
  ion: ComponentProps<typeof Icono>["ion"];
  texto: string;
  /** Color de la marca (WhatsApp); si no, el del tema. */
  color?: string;
  onPress?: () => void;
}) {
  const t = useTema();
  const color = onPress ? (colorPropio ?? t.tinte) : t.textoTer;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress ? () => (tocar(), onPress()) : undefined}
      style={({ pressed }) => [s.accion, { backgroundColor: t.celda, opacity: pressed ? 0.6 : 1 }]}
    >
      <Icono sf={sf} ion={ion} size={20} color={color} />
      <Text style={[tipo.leyenda, { color, fontWeight: "600" }]}>{texto}</Text>
    </Pressable>
  );
}

function Dato({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  const t = useTema();
  return (
    <View
      style={[s.dato, { backgroundColor: t.celda }]}
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
    >
      <Text
        style={[s.datoValor, { color: t.texto }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
      >
        {valor}
      </Text>
      <Text style={[tipo.leyenda, { color: t.textoSec }]} numberOfLines={1}>
        {etiqueta}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  heroe: { alignItems: "center", gap: 2, paddingTop: 4 },
  aro: { borderWidth: 2, borderRadius: 999, padding: 3 },
  etiquetas: { flexDirection: "row", gap: 6, marginTop: 10 },
  etiquetaPlan: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
  },
  etiquetaPlanTexto: { fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  etiqueta: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "center",
  },
  acciones: { flexDirection: "row", gap: 10, marginTop: 20 },
  accion: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  datos: { flexDirection: "row", gap: 10 },
  dato: {
    flex: 1,
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: "continuous",
  },
  datoValor: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
