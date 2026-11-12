import type { Rol } from "@mi-desorden/core";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import {
  BotonCabecera,
  BotonPrincipal,
  CampoFila,
  Contenido,
  Fila,
  Grupo,
  Icono,
  tocar,
  Vacio,
} from "@/components/ui";
import { SegmentadoAnimado } from "@/components/vistas";
import { generarClave, textoCredenciales } from "@/lib/claves";
import { NOMBRE_ROL, rolesAsignables, useRoles } from "@/lib/roles";
import { useAcciones, useInventario, useSesion } from "@/lib/store";
import { fuenteMarca, tipo, useTema } from "@/lib/theme";

type RolInvitable = Exclude<Rol, "owner">;

/** "A", "A y B", "A, B y C". */
const enLista = (n: string[]) =>
  n.length < 2 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} y ${n.at(-1)}`;

/** Cómo terminó: la cuenta nueva (con su contraseña) o un mensaje. */
type Resultado =
  | {
      tipo: "cuenta";
      nombre: string;
      email: string;
      clave: string;
      inventarios: string[];
      nota?: string;
    }
  | { tipo: "mensaje"; titulo: string; texto: string; error: boolean };

/**
 * Agregar a alguien a uno o varios inventarios, en su propia hoja (antes era un
 * formulario fijo al final de Accesos). Se crea su cuenta con una contraseña
 * temporal; si ya tenía cuenta, solo se le da acceso.
 */
export default function AgregarPersona() {
  const t = useTema();
  const { usuario } = useSesion();
  const { inventarios, activo, miRol } = useInventario();
  const { agregarEmpleado } = useAcciones();
  const roles = useRoles();

  const rolEn = (inv: (typeof inventarios)[number]): Rol =>
    inv.miembros.find((m) => m.usuario_id === usuario?.id)?.rol ?? "lector";
  const propios = inventarios.filter((i) => roles.permisos(rolEn(i)).gestionar_accesos);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [rol, setRol] = useState<RolInvitable>("lector");
  const [destinos, setDestinos] = useState<string[]>(() =>
    activo && propios.some((i) => i.id === activo.id) ? [activo.id] : [],
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const asignables = rolesAsignables(miRol);
  const rolElegido: RolInvitable = asignables.includes(rol) ? rol : "lector";
  const correo = email.trim().toLowerCase();
  const emailValido = /^\S+@\S+\.\S+$/.test(correo);
  // Con un solo inventario propio no hay lista: la persona va a ese.
  const elegidos = propios.length === 1 ? propios : propios.filter((i) => destinos.includes(i.id));
  const listo =
    nombre.trim().length >= 2 && emailValido && clave.length >= 8 && elegidos.length > 0;

  const cabecera = (
    <Stack.Screen
      options={{
        title: "Agregar persona",
        headerLeft: () => (
          <BotonCabecera texto={resultado ? "Cerrar" : "Cancelar"} onPress={() => router.back()} />
        ),
      }}
    />
  );

  if (!propios.length) {
    return (
      <>
        {cabecera}
        <Contenido>
          <Vacio
            sf="lock"
            ion="lock-closed-outline"
            titulo="Solo el owner agrega gente"
            texto="Pídele al owner del inventario que te agregue a quien necesites."
          />
        </Contenido>
      </>
    );
  }

  async function enviar() {
    if (!listo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const r = await agregarEmpleado({
        email: correo,
        nombre: nombre.trim(),
        clave,
        rol: rolElegido,
        inventarios: elegidos.map((i) => i.id),
      });
      if (!r.agregados.length) {
        setError(r.errores[0]?.mensaje ?? "No se pudo agregar.");
        return;
      }
      const nombres = elegidos
        .filter((i) => r.agregados.includes(i.id))
        .map((i) => `“${i.nombre}”`);
      const falla = r.errores.length
        ? ` En ${enLista(
            r.errores.map(
              (e) => `“${elegidos.find((i) => i.id === e.inventario)?.nombre ?? e.inventario}”`,
            ),
          )} no se pudo: ${r.errores[0]!.mensaje}`
        : "";
      if (r.creada) {
        setResultado({
          tipo: "cuenta",
          nombre: nombre.trim(),
          email: correo,
          clave,
          inventarios: nombres,
          nota: falla
            ? falla.trim()
            : r.confirmar
              ? `Le llegó un correo a ${correo} para confirmar la cuenta: tiene que abrirlo antes de entrar.`
              : undefined,
        });
      } else if (r.invitado) {
        setResultado({
          tipo: "mensaje",
          titulo: "Invitación enviada",
          texto:
            `Quedó invitado a ${enLista(nombres)}. Cuando cree su cuenta con ${correo} (en “Crear cuenta”), entra solo.` +
            falla,
          error: !!falla,
        });
      } else {
        setResultado({
          tipo: "mensaje",
          titulo: "Acceso dado",
          texto:
            `${correo} ya tenía cuenta: lo agregamos a ${enLista(nombres)} sin cambiar su contraseña.` +
            falla,
          error: !!falla,
        });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  function otra() {
    setResultado(null);
    setNombre("");
    setEmail("");
    setClave("");
    setVerClave(false);
  }

  const estiloInput = [
    tipo.cuerpo,
    { flex: 1, minWidth: 0, color: t.texto, paddingVertical: 0 },
    Platform.OS === "web" && ({ outlineStyle: "none" } as object),
  ];

  return (
    <>
      {cabecera}
      <Contenido
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        {resultado?.tipo === "cuenta" ? (
          <>
            <View style={s.hecho}>
              <Icono sf="checkmark.circle.fill" ion="checkmark-circle" size={48} color={t.verde} />
              <Text style={[s.hechoTitulo, { color: t.texto }]}>
                Cuenta de {resultado.nombre} creada
              </Text>
              <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
                Ya tiene acceso a {enLista(resultado.inventarios)}.
              </Text>
            </View>
            <Grupo
              titulo="Datos para entrar"
              pie={
                resultado.nota ??
                "Pásaselos ahora: la contraseña no se vuelve a mostrar. Al entrar por primera vez va a elegir la suya."
              }
              pieError={!!resultado.nota && !resultado.nota.startsWith("Le llegó")}
            >
              <Fila titulo="Correo" valor={resultado.email} />
              <View style={s.claveFila}>
                <Text style={[tipo.cuerpo, { color: t.texto }]}>Contraseña</Text>
                <Text selectable style={[tipo.cuerpo, s.claveTexto, { color: t.texto }]}>
                  {resultado.clave}
                </Text>
              </View>
            </Grupo>
            <BotonPrincipal
              onPress={() =>
                void Share.share({
                  message: textoCredenciales({
                    nombre: resultado.nombre,
                    email: resultado.email,
                    clave: resultado.clave,
                    inventarios: resultado.inventarios,
                  }),
                })
              }
            >
              Compartir datos
            </BotonPrincipal>
            <BotonPrincipal variante="gris" onPress={otra}>
              Agregar otra persona
            </BotonPrincipal>
          </>
        ) : resultado?.tipo === "mensaje" ? (
          <>
            <View style={s.hecho}>
              <Icono
                sf={resultado.error ? "exclamationmark.circle.fill" : "checkmark.circle.fill"}
                ion={resultado.error ? "alert-circle" : "checkmark-circle"}
                size={48}
                color={resultado.error ? t.tinte : t.verde}
              />
              <Text style={[s.hechoTitulo, { color: t.texto }]}>{resultado.titulo}</Text>
              <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
                {resultado.texto}
              </Text>
            </View>
            <BotonPrincipal onPress={() => router.back()}>Listo</BotonPrincipal>
            <BotonPrincipal variante="gris" onPress={otra}>
              Agregar otra persona
            </BotonPrincipal>
          </>
        ) : (
          <>
            <Grupo
              titulo="Persona"
              pie={
                error ??
                "Creas su cuenta con una contraseña temporal: al entrar por primera vez la cambia."
              }
              pieError={!!error}
            >
              <CampoFila
                etiqueta="Nombre"
                placeholder="Ej. Ana Pérez"
                value={nombre}
                onChangeText={(v) => (setNombre(v), setError(null))}
                autoCapitalize="words"
                maxLength={60}
                autoFocus
              />
              <CampoFila
                etiqueta="Correo"
                placeholder="ana@ejemplo.com"
                value={email}
                onChangeText={(v) => (setEmail(v), setError(null))}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="off"
              />
              <View style={s.claveFila}>
                <Text style={[tipo.cuerpo, { color: t.texto, width: 110 }]}>Contraseña</Text>
                <TextInput
                  placeholder="8 o más"
                  placeholderTextColor={t.textoTer}
                  accessibilityLabel="Contraseña temporal"
                  value={clave}
                  onChangeText={(v) => (setClave(v), setError(null))}
                  secureTextEntry={!verClave}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  maxLength={72}
                  selectionColor={t.tinte}
                  style={estiloInput}
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
              </View>
              <Fila
                titulo="Generar una contraseña"
                tinte
                onPress={() => (setClave(generarClave()), setVerClave(true), setError(null))}
              />
            </Grupo>

            {/* Sin tarjeta alrededor: el selector de vidrio es el mismo de Inventario. */}
            <View style={{ gap: 6 }}>
              <Text style={[tipo.nota, s.rotulo, { color: t.textoSec }]}>ROL</Text>
              <SegmentadoAnimado<RolInvitable>
                vidrio
                alto={44}
                valor={rolElegido}
                onCambio={setRol}
                opciones={(asignables.length ? asignables : (["lector"] as RolInvitable[])).map(
                  (r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] }),
                )}
              />
              {roles.descripcion(rolElegido) ? (
                <Text style={[tipo.nota, s.rotulo, { color: t.textoSec }]}>
                  <Text style={{ fontWeight: "600" }}>{roles.nombre(rolElegido)}: </Text>
                  {roles.descripcion(rolElegido)}
                </Text>
              ) : null}
            </View>

            {propios.length > 1 ? (
              <Grupo titulo="Inventarios" pie="Marca uno o varios." sangria={52}>
                {propios.map((i) => {
                  const marcado = destinos.includes(i.id);
                  return (
                    <Fila
                      key={i.id}
                      titulo={i.nombre}
                      subtitulo={i.lugar || undefined}
                      izquierda={
                        <Icono
                          sf={marcado ? "checkmark.circle.fill" : "circle"}
                          ion={marcado ? "checkmark-circle" : "ellipse-outline"}
                          size={22}
                          color={marcado ? t.tinte : t.textoTer}
                        />
                      }
                      onPress={() =>
                        setDestinos((d) =>
                          d.includes(i.id) ? d.filter((x) => x !== i.id) : [...d, i.id],
                        )
                      }
                    />
                  );
                })}
              </Grupo>
            ) : null}

            {/* En el contenido y no en el encabezado: en iOS 26 los botones del encabezado
                del modal perdían el primer toque con el teclado abierto. */}
            <BotonPrincipal onPress={enviar} deshabilitado={!listo} cargando={enviando}>
              Agregar
            </BotonPrincipal>
          </>
        )}
      </Contenido>
    </>
  );
}

const s = StyleSheet.create({
  claveFila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  claveTexto: {
    flex: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    letterSpacing: 1,
  },
  rotulo: { paddingHorizontal: 16 },
  hecho: { alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  hechoTitulo: { fontSize: 22, fontWeight: "700", fontFamily: fuenteMarca, textAlign: "center" },
});
