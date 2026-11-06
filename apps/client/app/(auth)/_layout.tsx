import { Stack } from "expo-router";
import { useTema } from "@/lib/theme";

// Expo Router 58 ya no acepta initialRouteName en <Stack>: va en unstable_settings.
export const unstable_settings = { initialRouteName: "login" };

export default function AuthLayout() {
  const t = useTema();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.fondo } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="registro" />
      <Stack.Screen name="confirmar" />
      <Stack.Screen name="callback" />
      <Stack.Screen name="recuperar" />
      <Stack.Screen name="clave-inicial" />
    </Stack>
  );
}
