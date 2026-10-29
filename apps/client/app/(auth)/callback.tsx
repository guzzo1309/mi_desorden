import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { MarcoAcceso } from "@/components/Acceso";
import { BotonPrincipal } from "@/components/ui";
import { useSesion } from "@/lib/store";

/**
 * A esta ruta vuelve el enlace del correo de confirmación
 * (midesorden://callback#access_token=…). Se lee la URL completa, porque la
 * sesión viene en el fragmento y los params de la ruta no lo incluyen. Con la
 * sesión iniciada, el guard del layout raíz lleva solo a las tabs.
 */
export default function Callback() {
  // useLinkingURL guarda del lado nativo el último enlace, aunque haya llegado
  // antes de montar esta pantalla (es justo el enlace que navegó hasta aquí).
  const url = Linking.useLinkingURL();
  const { completarDesdeEnlace } = useSesion();
  const [error, setError] = useState<string | null>(null);
  const hecho = useRef(false);

  useEffect(() => {
    // Solo el enlace del correo, no el del development client; los tokens sirven una vez.
    if (!url || !url.includes("callback") || hecho.current) return;
    hecho.current = true;
    completarDesdeEnlace(url)
      .then((tipo) => {
        // Enlace de recuperación: hay sesión, pero falta elegir la contraseña nueva.
        if (tipo === "recovery")
          router.replace({ pathname: "/recuperar", params: { paso: "nueva" } });
      })
      .catch((e: Error) => setError(e.message));
  }, [url, completarDesdeEnlace]);

  if (error) {
    return (
      <MarcoAcceso titulo="No pudimos confirmar" bajada={error}>
        <BotonPrincipal variante="gris" onPress={() => router.replace("/login")}>
          Volver a iniciar sesión
        </BotonPrincipal>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso titulo="Confirmando tu cuenta" bajada="Un segundo…">
      <View style={{ alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    </MarcoAcceso>
  );
}
