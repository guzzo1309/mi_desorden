import { Stack } from "expo-router";
import { opcionesHeader } from "@/lib/navegacion";
import { useTema } from "@/lib/theme";

export default function PerfilLayout() {
  const t = useTema();
  return (
    <Stack screenOptions={opcionesHeader(t)}>
      <Stack.Screen name="index" options={{ title: "Perfil" }} />
    </Stack>
  );
}
