import { Platform } from "react-native";
import type { Tema } from "@/lib/theme";

/** Opciones de header compartidas: título grande y transparente para que se vea el vidrio de iOS. */
export function opcionesHeader(t: Tema) {
  return {
    headerLargeTitle: true,
    headerTransparent: Platform.OS === "ios",
    headerBlurEffect: Platform.OS === "ios" ? undefined : ("systemChromeMaterial" as const),
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerStyle: { backgroundColor: Platform.OS === "ios" ? "transparent" : t.fondo },
    headerLargeStyle: { backgroundColor: "transparent" },
    headerTintColor: t.tinte,
    headerTitleStyle: { color: t.texto },
    headerLargeTitleStyle: { color: t.texto },
    contentStyle: { backgroundColor: t.fondo },
  };
}
