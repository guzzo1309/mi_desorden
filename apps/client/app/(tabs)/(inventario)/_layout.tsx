import { Stack } from "expo-router";
import { opcionesHeader } from "@/lib/navegacion";
import { useTema } from "@/lib/theme";

export default function InventarioLayout() {
  const t = useTema();
  return (
    <Stack screenOptions={opcionesHeader(t)}>
      <Stack.Screen name="index" options={{ title: "Inventario" }} />
    </Stack>
  );
}
