import { Alert, Platform } from "react-native";
import { confirmarWeb } from "@/web/dialogos";

/** Confirmación destructiva: alerta nativa en iOS/Android, confirm() en web. */
export function confirmar(titulo: string, mensaje: string, accion: string, onSi: () => void) {
  if (Platform.OS === "web") {
    if (confirmarWeb(titulo, mensaje)) onSi();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: "Cancelar", style: "cancel" },
    { text: accion, style: "destructive", onPress: onSi },
  ]);
}
