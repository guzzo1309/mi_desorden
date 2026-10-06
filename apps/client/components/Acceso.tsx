import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icono } from "@/components/ui";
import { tipo, useTema } from "@/lib/theme";

/** Marco de login/registro: ícono de app, título y formulario centrado. */
export function MarcoAcceso({
  titulo,
  bajada,
  children,
}: {
  titulo: string;
  bajada: string;
  children: ReactNode;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.fondo }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.contenido,
          { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={s.columna}>
          <View style={s.marca}>
            <View style={[s.icono, { backgroundColor: t.tinte, shadowColor: t.tinte }]}>
              <Icono sf="shippingbox.fill" ion="cube" size={40} color="#fff" weight="semibold" />
            </View>
            <Text style={[tipo.tituloGrande, { color: t.texto, textAlign: "center" }]}>
              {titulo}
            </Text>
            <Text style={[tipo.cuerpo, { color: t.textoSec, textAlign: "center" }]}>{bajada}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  contenido: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16 },
  columna: { width: "100%", maxWidth: 420, alignSelf: "center", gap: 28 },
  marca: { alignItems: "center", gap: 8 },
  icono: {
    width: 84,
    height: 84,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
