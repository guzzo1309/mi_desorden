import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useStore } from "@/lib/store";
import { useTema } from "@/lib/theme";

const queryClient = new QueryClient();

function Navegacion() {
  const { listo, usuario, recuperando } = useStore();
  // Con la recuperación en curso hay sesión, pero todavía no se entra a la app.
  const adentro = !!usuario && !recuperando;
  const t = useTema();

  if (!listo) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.fondo,
        }}
      >
        <ActivityIndicator />
      </View>
    );
  }

  const modal = {
    presentation: "modal" as const,
    headerShown: true,
    headerTintColor: t.tinte,
    headerTitleStyle: { color: t.texto },
    headerStyle: { backgroundColor: t.fondo },
    headerShadowVisible: false,
  };

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.fondo } }}>
      <Stack.Protected guard={adentro}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="abrir" />
        <Stack.Screen name="producto" options={{ ...modal, title: "Producto" }} />
        <Stack.Screen name="inventario-nuevo" options={{ ...modal, title: "Nuevo inventario" }} />
        <Stack.Screen name="categoria" options={{ ...modal, title: "Nueva categoría" }} />
        <Stack.Screen name="factura" options={{ ...modal, title: "Cargar factura" }} />
        <Stack.Screen name="solicitud" options={{ ...modal, title: "Pedido" }} />
        <Stack.Screen
          name="foto"
          options={{ presentation: "fullScreenModal", headerShown: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!adentro}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const t = useTema();
  const base = t.oscuro ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.fondo }}>
      <SafeAreaProvider>
        <ThemeProvider
          value={{
            ...base,
            colors: {
              ...base.colors,
              primary: t.tinte,
              background: t.fondo,
              card: t.celda,
              text: t.texto,
              border: t.separador,
            },
          }}
        >
          <QueryClientProvider client={queryClient}>
            <StoreProvider>
              <Navegacion />
              <StatusBar style="auto" />
            </StoreProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
