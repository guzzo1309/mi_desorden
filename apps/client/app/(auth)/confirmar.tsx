import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { MarcoAcceso } from "@/components/Acceso";
import { BotonPrincipal, CampoFila, Grupo } from "@/components/ui";
import { useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

const ESPERA = 60; // Supabase deja reenviar el correo una vez por minuto
/** Supabase deja configurar el largo del código entre 6 y 10 (este proyecto usa 8). */
const MIN_DIGITOS = 6;
const MAX_DIGITOS = 10;

/**
 * Después de registrarse (o de intentar entrar sin confirmar). Dos formas de
 * confirmar: tocar el enlace del correo en este teléfono (vuelve por /callback)
 * o escribir el código del correo, que sirve si el correo se abre en otro lado.
 */
export default function Confirmar() {
  const t = useTema();
  const { email = "", origen } = useLocalSearchParams<{ email?: string; origen?: string }>();
  // Desde el registro el correo acaba de salir: hay que esperar para reenviar.
  // Desde el login no se mandó nada ahora, así que se puede pedir uno ya.
  const recienEnviado = origen === "registro";
  const { confirmarConCodigo, reenviarConfirmacion } = useSesion();
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [espera, setEspera] = useState(recienEnviado ? ESPERA : 0);

  useEffect(() => {
    if (espera <= 0) return;
    const id = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [espera]);

  const completo = codigo.length >= MIN_DIGITOS;

  async function confirmar() {
    if (!completo || confirmando) return;
    setConfirmando(true);
    setAviso(null);
    try {
      // Con la sesión iniciada, el guard del layout raíz lleva solo a las tabs.
      await confirmarConCodigo(email, codigo);
    } catch (e) {
      setAviso({ texto: (e as Error).message, error: true });
      setConfirmando(false);
    }
  }

  async function reenviar() {
    setAviso(null);
    try {
      await reenviarConfirmacion(email);
      setEspera(ESPERA);
      setAviso({ texto: "Te mandamos otro correo.", error: false });
    } catch (e) {
      setAviso({ texto: (e as Error).message, error: true });
    }
  }

  return (
    <MarcoAcceso
      titulo={recienEnviado ? "Revisá tu correo" : "Confirmá tu cuenta"}
      bajada={
        recienEnviado
          ? `Te mandamos un correo a ${email}. Tocá el enlace desde este teléfono o escribí el código.`
          : `${email} todavía no está confirmado. Pedí un correo nuevo y escribí el código.`
      }
    >
      <Grupo pie={aviso?.texto} pieError={aviso?.error}>
        <CampoFila
          placeholder="Código del correo"
          value={codigo}
          onChangeText={(v) => setCodigo(v.replace(/\D/g, "").slice(0, MAX_DIGITOS))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          onSubmitEditing={confirmar}
        />
      </Grupo>
      <View style={{ gap: 12 }}>
        <BotonPrincipal onPress={confirmar} deshabilitado={!completo} cargando={confirmando}>
          Confirmar cuenta
        </BotonPrincipal>
        <BotonPrincipal variante="gris" onPress={reenviar} deshabilitado={espera > 0}>
          {espera > 0 ? `Reenviar correo (${espera} s)` : "Reenviar correo"}
        </BotonPrincipal>
        <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
          <Text
            onPress={() => router.replace("/login")}
            style={{ color: t.tinte, fontWeight: "600" }}
          >
            Volver a iniciar sesión
          </Text>
        </Text>
      </View>
    </MarcoAcceso>
  );
}
