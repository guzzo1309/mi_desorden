import type { Miembro, Rol } from "@mi-desorden/core";
import { router } from "expo-router";
import { useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Medidor } from "@/components/Medidor";
import { MenuPuntos, type Accion } from "@/components/menus";
import { Icono, tocar, Vacio } from "@/components/ui";
import {
  Encabezado,
  Seccion,
  Separador,
  Tarjeta,
  useEntrada,
  useSelectorInventario,
  Vista,
} from "@/components/vistas";
import { confirmar } from "@/lib/confirmar";
import { iniciales } from "@/lib/fecha";
import { useLimitesInventario } from "@/lib/miPlan";
import { NOMBRE_ROL, puedeAsignar, rolesAsignables, useRoles } from "@/lib/roles";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { fuenteMarca, useTema, type Tema } from "@/lib/theme";

/** Colores de avatar en la gama de la marca (tierra, ámbar, verde, azul apagado). */
const PALETA = ["#C46A14", "#9A6B3F", "#3E7C59", "#5B6EA8", "#A0525B", "#7A6A9E"];
const colorAvatar = (nombre: string) =>
  PALETA[[...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETA.length]!;

/** Hasta dónde llega el separador: relleno + avatar + hueco. */
const SANGRIA = 16 + 40 + 12;

/**
 * Quién tiene acceso al inventario abierto. Cada persona trae su ••• (cambiar el
 * rol o quitarle el acceso) y agregar a alguien abre su propia hoja.
 */
export default function Accesos() {
  const t = useTema();
  const { usuario } = useSesion();
  const { inventarios, activo, miRol } = useInventario();
  const { cancelarInvitacion, cambiarRol, quitarMiembro } = useAcciones();
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const entrada = useEntrada(3);
  const roles = useRoles();
  const { data: limites } = useLimitesInventario(activo?.id);
  const elegirInventario = useSelectorInventario();

  if (!activo) {
    return (
      <Vista titulo="Accesos">
        <Encabezado titulo="Accesos" style={entrada(0)} />
        <Vacio
          sf="person.2"
          ion="people-outline"
          titulo="Sin inventarios"
          texto="Crea un inventario para compartirlo con tu equipo."
        />
      </Vista>
    );
  }

  const gestiono = roles.permisos(miRol).gestionar_accesos;
  // ¿Puedo agregar gente en algún inventario? (la hoja deja elegir a cuáles)
  const puedoAgregar = inventarios.some(
    (i) =>
      roles.permisos(i.miembros.find((m) => m.usuario_id === usuario?.id)?.rol ?? "lector")
        .gestionar_accesos,
  );
  const asignables = rolesAsignables(miRol);
  const enLinea = activo.miembros.filter((m) => m.en_linea && m.usuario_id !== usuario?.id).length;
  const pendientes = gestiono ? activo.pendientes : [];
  const fallar = (e: Error) => setAviso({ texto: e.message, error: true });

  function cancelar(email: string) {
    if (!activo) return;
    confirmar(
      "¿Cancelar la invitación?",
      `${email} ya no va a poder entrar a “${activo.nombre}” cuando se registre.`,
      "Cancelar invitación",
      () =>
        cancelarInvitacion(activo.id, email)
          .then(() => setAviso({ texto: `Cancelaste la invitación de ${email}.`, error: false }))
          .catch(fallar),
    );
  }

  function quitar(m: Miembro) {
    if (!activo) return;
    const inv = activo.nombre;
    confirmar(`¿Quitar a ${m.nombre}?`, `Deja de ver “${inv}” al instante.`, "Quitar acceso", () =>
      quitarMiembro(activo.id, m.usuario_id)
        .then(() => setAviso({ texto: `${m.nombre} ya no ve “${inv}”.`, error: false }))
        .catch(fallar),
    );
  }

  /** El ••• de una persona: los roles que le puedo dar (el actual con ✓) y quitarla. */
  const accionesDe = (m: Miembro): Accion[][] => [
    asignables.map((r) => ({
      etiqueta: NOMBRE_ROL[r],
      sf:
        r === m.rol
          ? ("checkmark" as const)
          : r === "editor"
            ? ("pencil" as const)
            : ("eye" as const),
      onPress: () => {
        if (r === m.rol || !activo) return;
        setAviso(null);
        cambiarRol(activo.id, m.usuario_id, r)
          .then(() => setAviso({ texto: `${m.nombre} ahora es ${NOMBRE_ROL[r]}.`, error: false }))
          .catch(fallar);
      },
    })),
    [
      {
        etiqueta: "Quitar acceso",
        sf: "person.badge.minus",
        destructiva: true,
        onPress: () => quitar(m),
      },
    ],
  ];

  const pie =
    aviso?.texto ??
    (gestiono
      ? undefined
      : [`Tu rol aquí: ${roles.nombre(miRol)}.`, roles.descripcion(miRol)]
          .filter(Boolean)
          .join(" "));

  return (
    <Vista titulo="Accesos">
      <Encabezado
        sobre={activo.nombre}
        titulo="Accesos"
        alTocar={elegirInventario}
        tocarSobre
        style={entrada(0)}
      />

      {limites ? (
        <Animated.View style={entrada(1)}>
          <Medidor
            etiqueta="personas"
            usados={limites.personas}
            max={limites.max_personas}
            plan={limites.plan}
            onMejorar={gestiono ? () => router.push("/pedir-plan") : undefined}
          />
        </Animated.View>
      ) : null}

      <Seccion
        titulo="Equipo"
        derecha={
          <Text style={[s.cuenta, { color: t.textoSec }]}>
            {activo.miembros.length}
            {enLinea ? <Text style={{ color: t.verde }}>{` · ${enLinea} en línea`}</Text> : null}
          </Text>
        }
        pie={pie}
        pieColor={aviso?.error ? t.rojo : undefined}
        style={entrada(2)}
      >
        <Tarjeta>
          {activo.miembros.map((m, i) => {
            const yo = m.usuario_id === usuario?.id;
            const editable = gestiono && !yo && puedeAsignar(miRol, m.rol);
            return (
              <View key={m.usuario_id}>
                {i > 0 ? <Separador sangria={SANGRIA} /> : null}
                <View style={s.fila}>
                  <View>
                    <View style={[s.avatar, { backgroundColor: colorAvatar(m.nombre) }]}>
                      <Text style={s.avatarTexto}>{iniciales(m.nombre)}</Text>
                    </View>
                    {m.en_linea ? (
                      <View
                        style={[s.presencia, { backgroundColor: t.verde, borderColor: t.celda }]}
                      />
                    ) : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text style={[s.nombre, { color: t.texto }]} numberOfLines={1}>
                      {yo ? `${m.nombre} (tú)` : m.nombre}
                    </Text>
                    <Text style={[s.sub, { color: t.textoSec }]} numberOfLines={1}>
                      {m.en_linea && !yo ? (
                        <Text style={{ color: t.verde }}>Viendo ahora · </Text>
                      ) : null}
                      {m.email}
                    </Text>
                  </View>
                  <Insignia rol={m.rol} t={t} />
                  {editable ? (
                    <MenuPuntos titulo={m.nombre} grupos={accionesDe(m)} color={t.textoSec} />
                  ) : null}
                </View>
              </View>
            );
          })}

          {pendientes.map((p) => (
            <View key={p.email}>
              <Separador sangria={SANGRIA} />
              <View style={s.fila}>
                <View style={[s.avatar, { backgroundColor: t.relleno }]}>
                  <Icono sf="envelope" ion="mail-outline" size={18} color={t.textoSec} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[s.nombre, { color: t.texto }]} numberOfLines={1}>
                    {p.email}
                  </Text>
                  <Text style={[s.sub, { color: t.textoSec }]} numberOfLines={1}>
                    Invitación pendiente
                  </Text>
                </View>
                <Insignia rol={p.rol} t={t} />
                <MenuPuntos
                  titulo={p.email}
                  color={t.textoSec}
                  grupos={[
                    [
                      {
                        etiqueta: "Cancelar invitación",
                        sf: "xmark.circle",
                        destructiva: true,
                        onPress: () => cancelar(p.email),
                      },
                    ],
                  ]}
                />
              </View>
            </View>
          ))}

          {puedoAgregar ? (
            <View>
              <Separador sangria={SANGRIA} />
              <Pressable
                accessibilityRole="button"
                onPress={() => (tocar(), router.push("/agregar-persona"))}
                style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
              >
                <View style={[s.avatar, { backgroundColor: `${t.tinte}1F` }]}>
                  <Icono sf="plus" ion="add" size={20} color={t.tinte} weight="semibold" />
                </View>
                <Text style={[s.nombre, { color: t.tinte, flex: 1 }]}>Agregar persona</Text>
              </Pressable>
            </View>
          ) : null}
        </Tarjeta>
      </Seccion>
    </Vista>
  );
}

function Insignia({ rol, t }: { rol: Rol; t: Tema }) {
  const roles = useRoles();
  const owner = rol === "owner";
  return (
    <View style={[s.insignia, { backgroundColor: owner ? `${t.tinte}24` : t.relleno }]}>
      <Text style={[s.insigniaTexto, { color: owner ? t.tinte : t.textoSec }]}>
        {roles.nombre(rol)}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  cuenta: { fontSize: 15, fontVariant: ["tabular-nums"] },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: fuenteMarca },
  presencia: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  nombre: { fontSize: 17, letterSpacing: -0.4 },
  sub: { fontSize: 13 },
  insignia: { height: 24, paddingHorizontal: 10, borderRadius: 12, justifyContent: "center" },
  insigniaTexto: { fontSize: 13, fontWeight: "600" },
});
