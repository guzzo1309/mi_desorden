import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StoreProvider, useSesion } from "@/lib/store";
import { useTema } from "@/lib/theme";

const queryClient = new QueryClient();

function Navegacion() {
  const { listo, usuario, recuperando, debeCambiarClave, cargandoClave } = useSesion();
  // Con la recuperación en curso, o con la contraseña temporal del owner, hay sesión pero
  // todavía no se entra a la app.
  const adentro = !!usuario && !recuperando && !debeCambiarClave;
  const t = useTema();

  // Primer ingreso de un empleado: directo a elegir su contraseña (no al login).
  useEffect(() => {
    if (listo && usuario && debeCambiarClave && !recuperando) {
      router.replace("/(auth)/clave-inicial");
    }
  }, [listo, usuario, debeCambiarClave, recuperando]);

  if (!listo || cargandoClave) {
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
        <Stack.Screen name="plan" options={{ ...modal, title: "Plan" }} />
        <Stack.Screen name="revision" options={{ ...modal, title: "Completar productos" }} />
        <Stack.Screen name="historial" options={{ ...modal, title: "Historial" }} />
        <Stack.Screen name="pedir-plan" options={{ ...modal, title: "Cambiar de plan" }} />
        <Stack.Screen name="usuario" options={{ ...modal, title: "Cuenta" }} />
        <Stack.Screen
          name="foto"
          options={{ presentation: "fullScreenModal", headerShown: false }}
        />
        <Stack.Screen
          name="factura-camara"
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
