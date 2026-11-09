import type { Producto } from "@mi-desorden/core";
import { StyleSheet, Text, View } from "react-native";
import { Fila, Grupo } from "@/components/ui";
import { fichaDe, tieneFicha } from "@/lib/ficha";
import { tipo, useTema } from "@/lib/theme";

/**
 * Plantilla de la ficha técnica (solo lectura): descripción, marca, código y
 * especificaciones. La usa la pantalla app/ficha.tsx.
 */
export function FichaTecnica({
  producto,
  puedeEditar,
  onEditar,
}: {
  producto: Producto;
  puedeEditar: boolean;
  onEditar?: () => void;
}) {
  const t = useTema();
  const ficha = fichaDe(producto);
  const descripcion = producto.descripcion?.trim() ?? "";

  if (!tieneFicha(producto)) {
    return (
      <Grupo
        titulo="Ficha técnica"
        pie={
          puedeEditar
            ? "Agrega la marca, el código y los datos técnicos para que todo el equipo los vea."
            : "Todavía nadie cargó la ficha técnica de este producto. La completa un administrador."
        }
      >
        {puedeEditar && onEditar ? (
          <Fila titulo="Completar ficha técnica" tinte chevron onPress={onEditar} />
        ) : (
          <Fila titulo="Sin ficha técnica" apagada />
        )}
      </Grupo>
    );
  }

  return (
    <>
      {descripcion ? (
        <Grupo titulo="Descripción">
          <View style={s.descripcion}>
            <Text style={[tipo.cuerpo, { color: t.texto }]} selectable>
              {descripcion}
            </Text>
          </View>
        </Grupo>
      ) : null}

      <Grupo titulo="Ficha técnica">
        <Dato campo="Nombre" valor={producto.nombre} />
        {ficha.marca ? <Dato campo="Marca" valor={ficha.marca} /> : null}
        {ficha.codigo ? <Dato campo="Código" valor={ficha.codigo} /> : null}
        {ficha.especificaciones.map((e, i) => (
          <Dato key={`${e.campo}-${i}`} campo={e.campo} valor={e.valor} />
        ))}
      </Grupo>

      {puedeEditar && onEditar ? (
        <Grupo>
          <Fila titulo="Editar ficha técnica" tinte chevron onPress={onEditar} />
        </Grupo>
      ) : null}
    </>
  );
}

/** Una fila campo → valor. El valor puede ocupar varias líneas si es largo. */
function Dato({ campo, valor }: { campo: string; valor: string }) {
  const t = useTema();
  return (
    <View style={s.dato}>
      <Text style={[tipo.cuerpo, { color: t.texto, maxWidth: "45%" }]}>{campo}</Text>
      <Text style={[tipo.cuerpo, { color: t.textoSec, flex: 1, textAlign: "right" }]} selectable>
        {valor}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  descripcion: { paddingHorizontal: 16, paddingVertical: 12 },
  dato: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
});