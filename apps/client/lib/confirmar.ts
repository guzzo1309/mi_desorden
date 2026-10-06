import { Alert, Platform } from "react-native";

/** Confirmación destructiva: alerta nativa en iOS/Android, confirm() en web. */
export function confirmar(titulo: string, mensaje: string, accion: string, onSi: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) onSi();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: "Cancelar", style: "cancel" },
    { text: accion, style: "destructive", onPress: onSi },
  ]);
}
