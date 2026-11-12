import type { Especificacion, FichaInput } from "@mi-desorden/core";
import { Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { CampoFila, Fila, Grupo, Icono, tocar } from "@/components/ui";
import { FICHA_LIMITES } from "@/lib/ficha";
import { tipo, useTema } from "@/lib/theme";

/**
 * Marca, código y especificaciones dentro del formulario del producto (modo editar).
 * Los campos vacíos no se guardan, así que no hace falta "completar" nada aparte.
 */
export function EditorFicha({
  valor,
  onCambio,
}: {
  valor: FichaInput;
  onCambio: (f: FichaInput) => void;
}) {
  const t = useTema();
  const filas = valor.especificaciones;
  const cambiarFilas = (especificaciones: Especificacion[]) =>
    onCambio({ ...valor, especificaciones });
  const cambiarFila = (i: number, cambios: Partial<Especificacion>) =>
    cambiarFilas(filas.map((f, j) => (j === i ? { ...f, ...cambios } : f)));

  const estiloInput = [
    tipo.cuerpo,
    { color: t.texto, paddingVertical: 0 },
    Platform.OS === "web" && ({ outlineStyle: "none" } as object),
  ];

  return (
    <Grupo titulo="Ficha técnica" pie="Opcional. Lo que dejes vacío no se muestra.">
      <CampoFila
        etiqueta="Marca"
        placeholder="Agregar"
        value={valor.marca}
        onChangeText={(marca) => onCambio({ ...valor, marca })}
        maxLength={FICHA_LIMITES.marca}
      />
      <CampoFila
        etiqueta="Código"
        placeholder="SKU o referencia"
        value={valor.codigo}
        onChangeText={(codigo) => onCambio({ ...valor, codigo })}
        autoCapitalize="characters"
        maxLength={FICHA_LIMITES.codigo}
      />
      {filas.map((f, i) => (
        <View key={i} style={s.especificacion}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${f.campo || "dato"}`}
            hitSlop={8}
            onPress={() => {
              tocar();
              cambiarFilas(filas.filter((_, j) => j !== i));
            }}
          >
            <Icono sf="minus.circle.fill" ion="remove-circle" size={22} color={t.rojo} />
          </Pressable>
          <TextInput
            placeholder="Campo"
            placeholderTextColor={t.textoTer}
            selectionColor={t.tinte}
            value={f.campo}
            onChangeText={(campo) => cambiarFila(i, { campo })}
            maxLength={FICHA_LIMITES.campo}
            style={[...estiloInput, { width: 90 }]}
          />
          <TextInput
            placeholder="Valor"
            placeholderTextColor={t.textoTer}
            selectionColor={t.tinte}
            value={f.valor}
            onChangeText={(v) => cambiarFila(i, { valor: v })}
            maxLength={FICHA_LIMITES.valor}
            style={[...estiloInput, { flex: 1, minWidth: 0, textAlign: "right" }]}
          />
        </View>
      ))}
      {filas.length < FICHA_LIMITES.especificaciones ? (
        <Fila
          titulo="Agregar dato"
          tinte
          izquierda={<Icono sf="plus.circle.fill" ion="add-circle" size={22} color={t.verde} />}
          onPress={() => cambiarFilas([...filas, { campo: "", valor: "" }])}
        />
      ) : null}
    </Grupo>
  );
}

const s = StyleSheet.create({
  especificacion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    minHeight: 44,
    paddingVertical: 10,
  },
});
