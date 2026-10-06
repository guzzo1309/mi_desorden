import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { MarcoAcceso } from "@/components/Acceso";
import { BotonPrincipal, CampoFila, Grupo } from "@/components/ui";
import { useStore } from "@/lib/store";
import { tipo, useTema } from "@/lib/theme";

export default function Registro() {
  const t = useTema();
  const { registrar } = useStore();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [revisarCorreo, setRevisarCorreo] = useState(false);
  const listo =
    nombre.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(email.trim()) && clave.length >= 6;

  async function crear() {
    if (!listo || cargando) return;
    setError(null);
    setCargando(true);
    try {
      // Si Supabase no pide confirmar el correo, la sesión arranca sola y el guard navega.
      if (await registrar(nombre, email, clave)) setRevisarCorreo(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  if (revisarCorreo) {
    return (
      <MarcoAcceso
        titulo="Revisá tu correo"
        bajada={`Te mandamos un enlace a ${email.trim().toLowerCase()} para confirmar la cuenta.`}
      >
        <BotonPrincipal variante="gris" onPress={() => router.back()}>
          Volver a iniciar sesión
        </BotonPrincipal>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso titulo="Crear cuenta" bajada="Respaldá tu inventario y compartilo con tu equipo.">
      <Grupo pie={error ?? "La contraseña necesita al menos 6 caracteres."} pieError={!!error}>
        <CampoFila
          placeholder="Nombre"
          value={nombre}
          onChangeText={setNombre}
          autoComplete="name"
          textContentType="name"
        />
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
          textContentType="newPassword"
          onSubmitEditing={crear}
        />
      </Grupo>
      <View style={{ gap: 16 }}>
        <BotonPrincipal onPress={crear} deshabilitado={!listo} cargando={cargando}>
          Continuar
        </BotonPrincipal>
        <Text style={[tipo.subtitulo, { color: t.textoSec, textAlign: "center" }]}>
          ¿Ya tenés cuenta?{" "}
          <Text onPress={() => router.back()} style={{ color: t.tinte, fontWeight: "600" }}>
            Iniciar sesión
          </Text>
        </Text>
      </View>
    </MarcoAcceso>
  );
}
