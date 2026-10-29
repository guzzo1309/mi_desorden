import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { MarcoAcceso } from "@/components/Acceso";
import { BotonPrincipal, CampoFila, Grupo } from "@/components/ui";
import { useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

const ESPERA = 60; // Supabase deja pedir otro correo una vez por minuto
const MIN_DIGITOS = 6;
const MAX_DIGITOS = 10;

type Paso = "pedir" | "codigo" | "nueva";

/**
 * Recuperar la contraseña con Supabase Auth:
 * 1. pedir: se manda el correo de recuperación (código + enlace)
 * 2. codigo: código + clave nueva; verifica y cambia la clave antes de entrar
 * 3. nueva: solo la clave nueva (vino por el enlace del correo, o falló el cambio)
 */
export default function Recuperar() {
  const t = useTema();
  const params = useLocalSearchParams<{ email?: string; paso?: Paso }>();
  const { enviarRecuperacion, restablecerClave, guardarClaveNueva, cancelarRecuperacion } =
    useSesion();

  const [paso, setPaso] = useState<Paso>(params.paso === "nueva" ? "nueva" : "pedir");
  const [email, setEmail] = useState(params.email ?? "");
  const [codigo, setCodigo] = useState("");
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const correo = email.trim().toLowerCase();
  const emailValido = /^\S+@\S+\.\S+$/.test(correo);
  const claveValida = clave.length >= 6 && clave === repetir;
  const pieClave =
    clave.length > 0 && clave.length < 6
      ? `Faltan ${6 - clave.length} caracteres.`
      : repetir.length > 0 && clave !== repetir
        ? "Las contraseñas no coinciden."
        : "Mínimo 6 caracteres.";

  async function correr(fn: () => Promise<void>) {
    if (cargando) return;
    setCargando(true);
    setAviso(null);
    try {
      await fn();
    } catch (e) {
      const err = e as Error & { soloClave?: boolean };
      // El código sirvió pero no se pudo guardar la clave: reintentar solo la clave.
      if (err.soloClave) setPaso("nueva");
      setAviso({ texto: err.message, error: true });
    } finally {
      setCargando(false);
    }
  }

  const pedir = () =>
    correr(async () => {
      await enviarRecuperacion(correo);
      setPaso("codigo");
      setEspera(ESPERA);
      setAviso({ texto: `Si hay una cuenta con ${correo}, te llegó un código.`, error: false });
    });

  const reenviar = () =>
    correr(async () => {
      await enviarRecuperacion(correo);
      setEspera(ESPERA);
      setAviso({ texto: "Te mandamos otro correo. Usá el código más nuevo.", error: false });
    });

  // Con éxito, el layout raíz deja pasar a las tabs solo.
  const cambiar = () => correr(() => restablecerClave(correo, codigo, clave));
  const guardar = () => correr(() => guardarClaveNueva(clave));

  async function volver() {
    await cancelarRecuperacion().catch(() => {});
    router.replace("/login");
  }

  const camposClave = (
    <>
      <CampoFila
        placeholder="Contraseña nueva"
        value={clave}
        onChangeText={setClave}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <CampoFila
        placeholder="Repetir contraseña"
        value={repetir}
        onChangeText={setRepetir}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        onSubmitEditing={paso === "nueva" ? guardar : cambiar}
      />
    </>
  );

  const pie =
    aviso?.texto ??
    (paso === "pedir" ? "Te mandamos un código para elegir una contraseña nueva." : pieClave);

  return (
    <MarcoAcceso
      titulo={paso === "pedir" ? "Recuperá tu contraseña" : "Elegí una contraseña nueva"}
      bajada={
        paso === "pedir"
          ? "Escribí el correo de tu cuenta."
          : paso === "codigo"
            ? `Escribí el código que mandamos a ${correo} y tu contraseña nueva.`
            : "Ya verificamos tu correo. Solo falta la contraseña nueva."
      }
    >
      <Grupo pie={pie} pieError={aviso?.error ?? (clave.length > 0 && !claveValida)}>
        {paso === "pedir" ? (
          <CampoFila
            placeholder="Correo"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            onSubmitEditing={pedir}
          />
        ) : null}
        {paso === "codigo" ? (
          <CampoFila
            placeholder="Código del correo"
            value={codigo}
            onChangeText={(v) => setCodigo(v.replace(/\D/g, "").slice(0, MAX_DIGITOS))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
        ) : null}
        {paso !== "pedir" ? camposClave : null}
      </Grupo>

      <View style={{ gap: 12 }}>
        {paso === "pedir" ? (
          <BotonPrincipal onPress={pedir} deshabilitado={!emailValido} cargando={cargando}>
            Enviar código
          </BotonPrincipal>
        ) : paso === "codigo" ? (
          <>
            <BotonPrincipal
              onPress={cambiar}
              deshabilitado={codigo.length < MIN_DIGITOS || !claveValida}
              cargando={cargando}
            >
              Cambiar contraseña
            </BotonPrincipal>
            <BotonPrincipal
              variante="gris"
              onPress={reenviar}
              deshabilitado={espera > 0 || cargando}
            >
              {espera > 0 ? `Reenviar código (${espera} s)` : "Reenviar código"}
            </BotonPrincipal>
          </>
        ) : (
          <BotonPrincipal onPress={guardar} deshabilitado={!claveValida} cargando={cargando}>
            Guardar contraseña
          </BotonPrincipal>
        )}
        <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
          <Text onPress={volver} style={{ color: t.tinte, fontWeight: "600" }}>
            Volver a iniciar sesión
          </Text>
        </Text>
      </View>
    </MarcoAcceso>
  );
}
