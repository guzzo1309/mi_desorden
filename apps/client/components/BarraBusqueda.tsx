import { StyleSheet, TextInput } from "react-native";
import { Icono, Vidrio } from "@/components/ui";
import { useTema } from "@/lib/theme";

/** La barra de búsqueda de vidrio (la de Inventario), para cualquier lista. */
export function BarraBusqueda({
  valor,
  onCambio,
  placeholder,
}: {
  valor: string;
  onCambio: (texto: string) => void;
  placeholder: string;
}) {
  const t = useTema();
  return (
    <Vidrio claro interactivo style={[s.barra, { borderColor: t.separador }]}>
      <Icono sf="magnifyingglass" ion="search" size={17} color={t.textoSec} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={t.textoTer}
        value={valor}
        onChangeText={onCambio}
        clearButtonMode="while-editing"
        returnKeyType="search"
        autoCorrect={false}
        selectionColor={t.tinte}
        accessibilityLabel={placeholder}
        style={[s.input, { color: t.texto }]}
      />
    </Vidrio>
  );
}

const s = StyleSheet.create({
  barra: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, minWidth: 0, fontSize: 17, letterSpacing: -0.4, paddingVertical: 0 },
});
