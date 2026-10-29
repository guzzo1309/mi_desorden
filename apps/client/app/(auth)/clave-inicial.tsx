import { useState } from "react";
import { Text, View } from "react-native";
import { MarcoAcceso } from "@/components/Acceso";
import { BotonPrincipal, CampoFila, Grupo } from "@/components/ui";
import { mensajeError } from "@/api";
import { useSesion } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

const MIN = 8;

/**
 * Primer ingreso de alguien al que el owner le creó la cuenta: la contraseña
 * que tiene es temporal y tiene que elegir la suya antes de entrar a la app.
 */
export default function ClaveInicial() {
  const t = useTema();
  const { usuario, cambiarClaveInicial, cerrarSesion } = useSesion();
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const valida = clave.length >= MIN && clave === repetir;
  const pie =
    error ??
    (clave.length > 0 && clave.length < MIN
      ? `Faltan ${MIN - clave.length} caracteres.`
      : repetir.length > 0 && clave !== repetir
        ? "Las contraseñas no coinciden."
        : `Mínimo ${MIN} caracteres. Tiene que ser distinta de la temporal.`);

  async function guardar() {
    if (!valida || cargando) return;
    setCargando(true);
    setError(null);
    try {
      // Con éxito, el layout raíz deja pasar a la app solo.
      await cambiarClaveInicial(clave);
    } catch (e) {
      setError(mensajeError(e));
      setCargando(false);
    }
  }

  return (
    <MarcoAcceso
      titulo="Elige tu contraseña"
      bajada={`${usuario?.nombre ?? "Hola"}, tu cuenta la creó el owner con una contraseña temporal. Elige una tuya para seguir.`}
    >
      <Grupo pie={pie} pieError={!!error || (repetir.length > 0 && clave !== repetir)}>
        <CampoFila
          placeholder="Contraseña nueva"
          value={clave}
          onChangeText={(v) => (setClave(v), setError(null))}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          autoFocus
        />
        <CampoFila
          placeholder="Repetir contraseña"
          value={repetir}
          onChangeText={(v) => (setRepetir(v), setError(null))}
          secureTextEntry
          textContentType="newPassword"
          autoComplete="new-password"
          onSubmitEditing={guardar}
        />
      </Grupo>

      <View style={{ gap: 12 }}>
        <BotonPrincipal onPress={guardar} deshabilitado={!valida} cargando={cargando}>
          Guardar y entrar
        </BotonPrincipal>
        <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
          <Text onPress={() => void cerrarSesion()} style={{ color: t.tinte, fontWeight: "600" }}>
            Cerrar sesión
          </Text>
        </Text>
      </View>
    </MarcoAcceso>
  );
}
