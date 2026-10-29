import type { Miembro, Rol } from "@mi-desorden/core";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { Medidor } from "@/components/Medidor";
import { Icono, tocar, Vacio } from "@/components/ui";
import {
  Encabezado,
  Seccion,
  SegmentadoAnimado,
  Separador,
  Tarjeta,
  useEntrada,
  useSelectorInventario,
  Vista,
} from "@/components/vistas";
import { generarClave, textoCredenciales } from "@/lib/claves";
import { confirmar } from "@/lib/confirmar";
import { iniciales } from "@/lib/fecha";
import { useLimitesInventario } from "@/lib/miPlan";
import { NOMBRE_ROL, puedeAsignar, rolesAsignables, useRoles } from "@/lib/roles";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { useTema, type Tema } from "@/lib/theme";

const PALETA = ["#FF9500", "#007AFF", "#AF52DE", "#34C759", "#FF2D55", "#5AC8FA"];
const colorAvatar = (nombre: string) =>
  PALETA[[...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETA.length]!;

type RolInvitable = Exclude<Rol, "owner">;

/** Opciones del selector de rol, de menos a más permisos. */
const opcionesRol = (roles: RolInvitable[]) =>
  roles.map((r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] }));

export default function Accesos() {
  const t = useTema();
  const { usuario } = useSesion();
  const { inventarios, activo, miRol } = useInventario();
  const { agregarEmpleado, cancelarInvitacion, cambiarRol, quitarMiembro } = useAcciones();
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  // Lo que hay que pasarle a quien se acaba de agregar. La contraseña no se vuelve a mostrar.
  const [credenciales, setCredenciales] = useState<{
    nombre: string;
    email: string;
    clave: string;
    inventarios: string[];
  } | null>(null);
  const [rol, setRol] = useState<RolInvitable>("lector");
  const [enviando, setEnviando] = useState(false);
  // neutro: salió a medias (acceso dado pero sin correo), ni verde ni rojo.
  const [aviso, setAviso] = useState<{ texto: string; error: boolean; neutro?: boolean } | null>(
    null,
  );
  const entrada = useEntrada(4);
  const roles = useRoles();
  const { data: limites } = useLimitesInventario(activo?.id);
  const elegirInventario = useSelectorInventario();

  // Inventarios donde puedo invitar (mi rol gestiona accesos) y a cuáles va la invitación.
  const rolEn = (inv: (typeof inventarios)[number]): Rol =>
    inv.miembros.find((m) => m.usuario_id === usuario?.id)?.rol ?? "lector";
  const propios = inventarios.filter((i) => roles.permisos(rolEn(i)).gestionar_accesos);
  const [destinos, setDestinos] = useState<string[]>([]);
  const activoId = activo?.id;
  const activoPropio = propios.some((i) => i.id === activoId);
  // Al cambiar de inventario, la invitación arranca apuntando al que estás viendo.
  useEffect(() => {
    setDestinos(activoId && activoPropio ? [activoId] : []);
  }, [activoId, activoPropio]);
  const alternar = (id: string) =>
    setDestinos((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));

  if (!activo) {
    return (
      <Vista>
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
  // Roles que puedo dar aquí: solo el owner, a sus empleados (lector o editor).
  const asignables = rolesAsignables(miRol);
  const rolElegido: RolInvitable = asignables.includes(rol) ? rol : "lector";
  const enLinea = activo.miembros.filter((m) => m.en_linea).length;
  const correo = email.trim().toLowerCase();
  const emailValido = /^\S+@\S+\.\S+$/.test(correo);
  const fallar = (e: Error) => setAviso({ texto: e.message, error: true });

  // Con un solo inventario propio no hay lista: la persona se agrega a ese.
  const elegidos = propios.length === 1 ? propios : propios.filter((i) => destinos.includes(i.id));
  const puedeEnviar =
    nombre.trim().length >= 2 &&
    emailValido &&
    clave.length >= 8 &&
    elegidos.length > 0 &&
    !enviando;

  async function enviar() {
    if (!puedeEnviar) return;
    setEnviando(true);
    setAviso(null);
    setCredenciales(null);
    try {
      const r = await agregarEmpleado({
        email: correo,
        nombre: nombre.trim(),
        clave,
        rol: rolElegido,
        inventarios: elegidos.map((i) => i.id),
      });
      if (!r.agregados.length) {
        return setAviso({ texto: r.errores[0]?.mensaje ?? "No se pudo agregar.", error: true });
      }
      const nombres = elegidos.filter((i) => r.agregados.includes(i.id)).map((i) => i.nombre);
      const falla = r.errores.length
        ? ` En ${enLista(
            r.errores.map(
              (e) => `“${elegidos.find((i) => i.id === e.inventario)?.nombre ?? e.inventario}”`,
            ),
          )} no se pudo: ${r.errores[0]!.mensaje}`
        : "";
      if (r.invitado) {
        setAviso({
          texto:
            `Quedó invitado a ${enLista(nombres.map((n) => `“${n}”`))}. Cuando cree su cuenta con ${correo} (en “Crear cuenta”), entra solo.` +
            falla,
          error: !!falla,
        });
      } else if (r.creada) {
        setCredenciales({ nombre: nombre.trim(), email: correo, clave, inventarios: nombres });
        if (falla) setAviso({ texto: falla.trim(), error: true });
      } else {
        setAviso({
          texto:
            `${correo} ya tenía cuenta: lo agregamos a ${enLista(nombres.map((n) => `“${n}”`))} sin cambiar su contraseña.` +
            falla,
          error: !!falla,
        });
      }
      setNombre("");
      setEmail("");
      setClave("");
      setVerClave(false);
    } catch (e) {
      fallar(e as Error);
    } finally {
      setEnviando(false);
    }
  }

  function cancelar(email: string) {
    if (!activo) return;
    const inv = activo.nombre;
    confirmar(
      "¿Cancelar la invitación?",
      `${email} ya no va a poder entrar a “${inv}” cuando se registre.`,
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
    confirmar(
      `¿Quitar a ${m.nombre}?`,
      `Deja de ver “${inv}” al instante.`,
      "Quitar acceso",
      () => {
        setAbierto(null);
        quitarMiembro(activo.id, m.usuario_id)
          .then(() => setAviso({ texto: `${m.nombre} ya no ve “${inv}”.`, error: false }))
          .catch(fallar);
      },
    );
  }

  const colorAviso = !aviso
    ? t.textoSec
    : aviso.error
      ? t.rojo
      : aviso.neutro
        ? t.texto
        : t.oscuro
          ? t.verde
          : "#248A3D";

  // Sin nadie más en el inventario, lo primero que se quiere hacer es invitar: va arriba.
  const soloYo = gestiono && activo.miembros.length === 1 && !activo.pendientes.length;

  const equipo = (
    <>
      <Seccion
        titulo={
          `${activo.miembros.length} ${activo.miembros.length === 1 ? "persona" : "personas"} · ${enLinea} en línea` +
          (gestiono && activo.pendientes.length
            ? ` · ${activo.pendientes.length} ${activo.pendientes.length === 1 ? "pendiente" : "pendientes"}`
            : "")
        }
        derecha={
          <View style={s.pila}>
            {activo.miembros.slice(0, 5).map((m) => (
              <View
                key={m.usuario_id}
                style={[s.mini, { backgroundColor: colorAvatar(m.nombre), borderColor: t.fondo }]}
              >
                <Text style={s.miniTexto}>{iniciales(m.nombre)}</Text>
              </View>
            ))}
          </View>
        }
        pie={
          gestiono
            ? soloYo
              ? "Cuando invites a alguien, lo vas a ver aquí."
              : activo.pendientes.length
                ? "Toca a alguien para cambiar su rol o quitarle el acceso, o una invitación para cancelarla."
                : "Toca a alguien para cambiar su rol o quitarle el acceso."
            : [`Tu rol en este inventario: ${roles.nombre(miRol)}.`, roles.descripcion(miRol)]
                .filter(Boolean)
                .join(" ")
        }
        style={entrada(2)}
      >
        {limites ? (
          <Medidor
            etiqueta="personas"
            usados={limites.personas}
            max={limites.max_personas}
            plan={limites.plan}
            onMejorar={gestiono ? () => router.push("/pedir-plan") : undefined}
          />
        ) : null}
        <Tarjeta>
          {activo.miembros.map((m, i) => {
            const yo = m.usuario_id === usuario?.id;
            const editable = gestiono && !yo && puedeAsignar(miRol, m.rol);
            const abiertoEste = abierto === m.usuario_id;
            return (
              <View key={m.usuario_id}>
                {i > 0 ? <Separador sangria={68} /> : null}
                <Pressable
                  disabled={!editable}
                  accessibilityRole={editable ? "button" : undefined}
                  accessibilityState={editable ? { expanded: abiertoEste } : undefined}
                  onPress={() => (tocar(), setAbierto(abiertoEste ? null : m.usuario_id))}
                  style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
                >
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
                    <Text
                      style={[s.sub, { color: m.en_linea ? t.verde : t.textoSec }]}
                      numberOfLines={1}
                    >
                      {m.en_linea ? "Viendo ahora" : m.email}
                    </Text>
                  </View>
                  <Insignia rol={m.rol} t={t} />
                  {editable ? (
                    <View style={{ transform: [{ rotate: abiertoEste ? "90deg" : "0deg" }] }}>
                      <Icono
                        sf="chevron.right"
                        ion="chevron-forward"
                        size={13}
                        color={t.textoTer}
                        weight="semibold"
                      />
                    </View>
                  ) : null}
                </Pressable>
                {abiertoEste ? (
                  <View style={s.edicion}>
                    <View style={{ flex: 1 }}>
                      {asignables.length > 1 ? (
                        <SegmentadoAnimado<RolInvitable>
                          valor={m.rol === "editor" ? "editor" : "lector"}
                          onCambio={(r) => cambiarRol(activo.id, m.usuario_id, r).catch(fallar)}
                          opciones={opcionesRol(asignables)}
                        />
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => quitar(m)}
                      style={({ pressed }) => [
                        s.quitar,
                        { backgroundColor: hexA(t.rojo, 0.1), opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Text style={[s.quitarTexto, { color: t.rojo }]}>Quitar</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
          {gestiono
            ? activo.pendientes.map((p) => (
                <View key={p.email}>
                  <Separador sangria={68} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityHint="Cancela la invitación"
                    onPress={() => (tocar(), cancelar(p.email))}
                    style={({ pressed }) => [s.fila, pressed && { backgroundColor: t.relleno }]}
                  >
                    <View style={[s.avatar, { backgroundColor: t.relleno }]}>
                      <Icono sf="envelope" ion="mail-outline" size={18} color={t.textoSec} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={[s.nombre, { color: t.texto }]} numberOfLines={1}>
                        {p.email}
                      </Text>
                      <Text style={[s.sub, { color: t.textoSec }]} numberOfLines={1}>
                        Invitación pendiente · toca para cancelar
                      </Text>
                    </View>
                    <Insignia rol={p.rol} t={t} />
                  </Pressable>
                </View>
              ))
            : null}
        </Tarjeta>
      </Seccion>
    </>
  );

  const invitarJsx = (
    <>
      {propios.length ? (
        <Seccion
          titulo={propios.length > 1 ? "Agregar a" : "Agregar persona"}
          pie={
            aviso?.texto ??
            (credenciales
              ? undefined
              : (propios.length > 1 ? "Marca uno o varios inventarios. " : "") +
                "Creas su cuenta con una contraseña temporal: al entrar por primera vez la tiene que cambiar.")
          }
          pieColor={colorAviso}
          style={entrada(3)}
        >
          {credenciales ? (
            <Tarjeta style={s.listo}>
              <View style={s.listoCabecera}>
                <Icono
                  sf="checkmark.circle.fill"
                  ion="checkmark-circle"
                  size={26}
                  color={t.verde}
                />
                <Text style={[s.nombre, { color: t.texto, flex: 1 }]}>
                  Cuenta de {credenciales.nombre} creada
                </Text>
              </View>
              <View style={[s.datos, { backgroundColor: t.relleno }]}>
                <Text style={[s.sub, { color: t.textoSec }]}>Correo</Text>
                <Text selectable style={[s.dato, { color: t.texto }]}>
                  {credenciales.email}
                </Text>
                <Text style={[s.sub, { color: t.textoSec, marginTop: 8 }]}>
                  Contraseña temporal
                </Text>
                <Text selectable style={[s.dato, s.claveTexto, { color: t.texto }]}>
                  {credenciales.clave}
                </Text>
              </View>
              <Text style={[s.sub, { color: t.textoSec, paddingHorizontal: 4 }]}>
                Pásale estos datos ahora: la contraseña no se vuelve a mostrar. Al entrar por
                primera vez va a tener que elegir la suya.
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (
                    tocar(),
                    void Share.share({ message: textoCredenciales(credenciales) })
                  )}
                  style={({ pressed }) => [
                    s.darAcceso,
                    {
                      backgroundColor: t.tinte,
                      flex: 1,
                      alignItems: "center",
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={s.darAccesoTexto}>Compartir datos</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (tocar(), setCredenciales(null))}
                  style={({ pressed }) => [
                    s.darAcceso,
                    { backgroundColor: t.relleno, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[s.darAccesoTexto, { color: t.tinte }]}>Agregar otra</Text>
                </Pressable>
              </View>
            </Tarjeta>
          ) : (
            <Tarjeta style={s.invitar}>
              <View style={s.correo}>
                <Icono sf="person" ion="person-outline" size={20} color={t.textoTer} />
                <TextInput
                  placeholder="Nombre"
                  placeholderTextColor={t.textoTer}
                  accessibilityLabel="Nombre de la persona"
                  value={nombre}
                  onChangeText={(v) => (setNombre(v), setAviso(null))}
                  autoCapitalize="words"
                  maxLength={60}
                  selectionColor={t.tinte}
                  style={[s.correoInput, { color: t.texto }]}
                />
              </View>
              <Separador sangria={44} />
              <View style={s.correo}>
                <Icono sf="envelope" ion="mail-outline" size={20} color={t.textoTer} />
                <TextInput
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor={t.textoTer}
                  accessibilityLabel="Correo de la persona"
                  value={email}
                  onChangeText={(v) => (setEmail(v), setAviso(null))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="off"
                  selectionColor={t.tinte}
                  style={[s.correoInput, { color: t.texto }]}
                />
              </View>
              <Separador sangria={44} />
              <View style={s.correo}>
                <Icono sf="key" ion="key-outline" size={20} color={t.textoTer} />
                <TextInput
                  placeholder="Contraseña temporal (8 o más)"
                  placeholderTextColor={t.textoTer}
                  accessibilityLabel="Contraseña temporal"
                  value={clave}
                  onChangeText={(v) => (setClave(v), setAviso(null))}
                  secureTextEntry={!verClave}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  maxLength={72}
                  returnKeyType="done"
                  selectionColor={t.tinte}
                  style={[s.correoInput, { color: t.texto }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}
                  hitSlop={8}
                  onPress={() => (tocar(), setVerClave((v) => !v))}
                >
                  <Icono
                    sf={verClave ? "eye.slash" : "eye"}
                    ion={verClave ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={t.textoSec}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityHint="Crea una contraseña al azar y la muestra"
                  hitSlop={8}
                  onPress={() => (
                    tocar(),
                    setClave(generarClave()),
                    setVerClave(true),
                    setAviso(null)
                  )}
                >
                  <Text style={{ color: t.tinte, fontWeight: "600", fontSize: 15 }}>Generar</Text>
                </Pressable>
              </View>
              {propios.length > 1 ? (
                <View style={[s.destinos, { borderColor: t.separador }]}>
                  {propios.map((i, n) => {
                    const marcado = destinos.includes(i.id);
                    return (
                      <View key={i.id}>
                        {n > 0 ? <Separador sangria={44} /> : null}
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: marcado }}
                          onPress={() => (tocar(), alternar(i.id), setAviso(null))}
                          style={({ pressed }) => [s.destino, pressed && { opacity: 0.6 }]}
                        >
                          <Icono
                            sf={marcado ? "checkmark.circle.fill" : "circle"}
                            ion={marcado ? "checkmark-circle" : "ellipse-outline"}
                            size={22}
                            color={marcado ? t.tinte : t.textoTer}
                          />
                          <Text style={[s.destinoTexto, { color: t.texto }]} numberOfLines={1}>
                            {i.nombre}
                          </Text>
                          {i.lugar ? (
                            <Text style={[s.sub, { color: t.textoSec }]} numberOfLines={1}>
                              {i.lugar}
                            </Text>
                          ) : null}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: 6 }}>
                <View style={{ flex: 1 }}>
                  <SegmentadoAnimado<RolInvitable>
                    valor={rolElegido}
                    onCambio={setRol}
                    alto={44}
                    redondo
                    opciones={opcionesRol(asignables.length ? asignables : ["lector"])}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !puedeEnviar, busy: enviando }}
                  disabled={!puedeEnviar}
                  onPress={() => (tocar(), enviar())}
                  style={({ pressed }) => [
                    s.darAcceso,
                    {
                      backgroundColor: t.tinte,
                      opacity: !puedeEnviar ? 0.4 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={s.darAccesoTexto}>{enviando ? "Agregando…" : "Agregar"}</Text>
                </Pressable>
              </View>
              {roles.descripcion(rolElegido) ? (
                <Text
                  style={[s.sub, { color: t.textoSec, paddingHorizontal: 12, paddingBottom: 6 }]}
                >
                  <Text style={{ fontWeight: "600" }}>{roles.nombre(rolElegido)}: </Text>
                  {roles.descripcion(rolElegido)}
                </Text>
              ) : null}
            </Tarjeta>
          )}
        </Seccion>
      ) : (
        <Animated.Text style={[s.soloDueño, { color: t.textoSec }, entrada(3)]}>
          Solo el owner del inventario invita gente.
        </Animated.Text>
      )}
    </>
  );

  return (
    <Vista>
      <Encabezado
        sobre={activo.nombre}
        titulo="Accesos"
        alTocar={elegirInventario}
        tocarSobre
        style={entrada(0)}
      />

      {equipo}
      {invitarJsx}
    </Vista>
  );
}

function Insignia({ rol, t }: { rol: Rol; t: Tema }) {
  const roles = useRoles();
  const owner = rol === "owner";
  return (
    <View style={[s.insignia, { backgroundColor: owner ? hexA(t.tinte, 0.14) : t.relleno }]}>
      <Text
        style={[s.insigniaTexto, { color: owner ? (t.oscuro ? t.tinte : "#C46E00") : t.textoSec }]}
      >
        {roles.nombre(rol)}
      </Text>
    </View>
  );
}

/** "A", "A y B", "A, B y C". */
function enLista(nombres: string[]) {
  return nombres.length < 2
    ? (nombres[0] ?? "")
    : `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

function hexA(hex: string, a: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const s = StyleSheet.create({
  pila: { flexDirection: "row", paddingLeft: 6 },
  mini: {
    width: 22,
    height: 22,
    marginLeft: -6,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  miniTexto: { color: "#fff", fontSize: 9, fontWeight: "700" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingLeft: 16,
    paddingRight: 14,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
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
  edicion: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 4,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 68,
  },
  quitar: { height: 34, paddingHorizontal: 12, borderRadius: 10, justifyContent: "center" },
  quitarTexto: { fontSize: 13, fontWeight: "600" },
  invitar: { padding: 6, gap: 6 },
  destinos: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  destino: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  destinoTexto: { flexShrink: 1, fontSize: 17, letterSpacing: -0.4 },
  correo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 48,
    paddingHorizontal: 12,
  },
  correoInput: { flex: 1, minWidth: 0, fontSize: 17, letterSpacing: -0.4, paddingVertical: 0 },
  darAcceso: { height: 44, paddingHorizontal: 18, borderRadius: 22, justifyContent: "center" },
  darAccesoTexto: { color: "#fff", fontSize: 15, fontWeight: "600" },
  listo: { padding: 14, gap: 12 },
  listoCabecera: { flexDirection: "row", alignItems: "center", gap: 10 },
  datos: { borderRadius: 12, padding: 12 },
  dato: { fontSize: 17, letterSpacing: -0.4 },
  claveTexto: { fontVariant: ["tabular-nums"], fontWeight: "600", letterSpacing: 1 },
  soloDueño: { fontSize: 13, textAlign: "center" },
});
