import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { MarcoAcceso } from "@/components/Acceso";
import { BotonPrincipal, CampoFila, Grupo } from "@/components/ui";
import { useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

export default function Login() {
  const t = useTema();
  const { iniciarSesion } = useStore();
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const listo = email.includes("@") && clave.length >= 6;

  async function entrar() {
    if (!listo || cargando) return;
    setError(null);
    setCargando(true);
    try {
      await iniciarSesion(email, clave);
    } catch (e) {
      setError((e as Error).message);
      setCargando(false);
    }
  }

  return (
    <MarcoAcceso titulo="mi_desorden" bajada="Tu inventario, contado por la cámara.">
      <Grupo pie={error ?? undefined} pieError>
        <CampoFila
          placeholder="Correo"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <CampoFila
          placeholder="Contraseña"
          value={clave}
          onChangeText={setClave}
          secureTextEntry
          textContentType="password"
          onSubmitEditing={entrar}
        />
      </Grupo>
      <View style={{ gap: 16 }}>
        <BotonPrincipal onPress={entrar} deshabilitado={!listo} cargando={cargando}>
          Iniciar sesión
        </BotonPrincipal>
        <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
          ¿No tenés cuenta?{" "}
          <Link href="/registro" style={{ color: t.tinte, fontWeight: "600" }}>
            Crear una
          </Link>
        </Text>
      </View>
    </MarcoAcceso>
  );
}
