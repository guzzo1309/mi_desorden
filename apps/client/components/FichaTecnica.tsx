import type { Producto } from "@mi-desorden/core";
import { StyleSheet, Text, View } from "react-native";
import { Grupo } from "@/components/ui";
import { fichaDe } from "@/lib/ficha";
import { tipo, useTema } from "@/lib/theme";

/**
 * Descripción y ficha técnica en el modo ver del producto (app/producto.tsx).
 * Solo muestra lo que tiene dato; se edita con el botón Editar de la pantalla.
 */
export function FichaTecnica({
  producto,
  sinMarcaCodigo,
}: {
  producto: Producto;
  /** La marca y el código ya se muestran en otro lado (los Detalles del producto). */
  sinMarcaCodigo?: boolean;
}) {
  const t = useTema();
  const ficha = fichaDe(producto);
  const descripcion = producto.descripcion?.trim() ?? "";
  const especificaciones = ficha.especificaciones.filter((e) => e.valor.trim());
  const marca = sinMarcaCodigo ? "" : ficha.marca;
  const codigo = sinMarcaCodigo ? "" : ficha.codigo;
  const hayDatos = !!(marca || codigo || especificaciones.length);

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

      {hayDatos ? (
        <Grupo titulo="Ficha técnica">
          {marca ? <Dato campo="Marca" valor={marca} /> : null}
          {codigo ? <Dato campo="Código" valor={codigo} /> : null}
          {especificaciones.map((e, i) => (
            <Dato key={`${e.campo}-${i}`} campo={e.campo} valor={e.valor} />
          ))}
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
