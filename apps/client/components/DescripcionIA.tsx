import type { DescripcionIa } from "@mi-desorden/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { ia } from "@/api";
import { Fila, Grupo, Icono } from "@/components/ui";
import { nivelCupo } from "@/lib/planes";
import { tipo, useTema } from "@/lib/theme";

/** Igual que el check de productos.descripcion. */
export const MAX_DESCRIPCION = 1000;

/** 12500 → "12.500". */
const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * La descripción (ficha) del producto. La ve todo el que tiene acceso; la edita
 * quien puede editar productos. El owner, además, le pide a la IA que la escriba
 * desde cero o que le sugiera cambios a lo que ya escribió, y decide si la usa.
 */
export function DescripcionIA({
  valor,
  onCambio,
  editable,
  puedeIa,
  inventarioId,
  productoId,
  nombre,
  categoria,
  categorias,
  onCategoriaSugerida,
}: {
  valor: string;
  onCambio: (texto: string) => void;
  editable: boolean;
  /** Permiso usar_ia (solo el owner). */
  puedeIa: boolean;
  inventarioId: string;
  /** Null en un producto que todavía no se guardó. */
  productoId: string | null;
  nombre: string;
  /** Nombre de la categoría elegida, si hay. */
  categoria: string | null;
  /** Nombres de las categorías del inventario: la IA sugiere una. */
  categorias: string[];
  onCategoriaSugerida?: (nombre: string) => void;
}) {
  const t = useTema();
  const qc = useQueryClient();
  const [pidiendo, setPidiendo] = useState(false);
  const [sugerencia, setSugerencia] = useState<DescripcionIa | null>(null);
  const [error, setError] = useState<string | null>(null);

  const usoQ = useQuery({
    queryKey: ["uso-ia"],
    queryFn: ia.miUso,
    enabled: puedeIa && editable,
    staleTime: 60_000,
  });
  const uso = sugerencia?.uso ?? usoQ.data;
  const nivel = uso ? nivelCupo(uso.usados, uso.limite) : "libre";

  const borrador = valor.trim();
  const sinNombre = !nombre.trim();
  const modo = borrador ? "mejorar" : "generar";

  async function pedir() {
    if (pidiendo || sinNombre) return;
    setPidiendo(true);
    setError(null);
    try {
      const r = await ia.descripcion({
        inventario_id: inventarioId,
        producto_id: productoId,
        modo,
        nombre: nombre.trim(),
        categoria,
        ...(modo === "mejorar" ? { borrador } : {}),
        categorias,
      });
      setSugerencia(r);
      qc.setQueryData(["uso-ia"], r.uso);
    } catch (e) {
      setError((e as Error).message);
      // Si fue por el límite, que el aviso muestre lo que de verdad queda.
      qc.invalidateQueries({ queryKey: ["uso-ia"] });
    } finally {
      setPidiendo(false);
    }
  }

  function usar() {
    if (!sugerencia) return;
    onCambio(sugerencia.descripcion.slice(0, MAX_DESCRIPCION));
    setSugerencia(null);
  }

  // Pie del grupo: error, aviso de límite, o cuánto queda.
  let pie: string | undefined;
  let pieError = false;
  if (error) {
    pie = error;
    pieError = true;
  } else if (puedeIa && editable && uso) {
    if (uso.limite === null) {
      pie = "La IA no tiene límite en tu plan.";
    } else if (nivel === "lleno" || uso.restantes === 0) {
      pie = "Usaste todos los tokens de IA de tu plan este mes. Se renuevan el día 1.";
      pieError = true;
    } else if (nivel === "cerca" || sugerencia?.cerca_del_limite) {
      const pct = Math.round((uso.usados / Math.max(uso.limite, 1)) * 100);
      pie = `Estás llegando al límite de IA de tu plan: llevas el ${pct} % del mes (quedan ${miles(uso.restantes ?? 0)} tokens).`;
      pieError = true;
    } else {
      pie = `Te quedan ${miles(uso.restantes ?? 0)} de ${miles(uso.limite)} tokens de IA este mes.`;
    }
  } else if (editable && !puedeIa) {
    pie = "La descripción la pueden escribir con IA solo los owners del inventario.";
  }

  const categoriaNueva =
    sugerencia?.categoria_sugerida &&
    sugerencia.categoria_sugerida !== categoria &&
    onCategoriaSugerida
      ? sugerencia.categoria_sugerida
      : null;

  return (
    <>
      <Grupo titulo="Descripción" pie={pie} pieError={pieError}>
        {editable ? (
          <View style={s.caja}>
            <TextInput
              value={valor}
              onChangeText={onCambio}
              placeholder={
                puedeIa
                  ? "Marca, modelo, tamaño o lo que lo distinga. O deja que la IA lo haga."
                  : "Qué es, para qué sirve, presentación…"
              }
              placeholderTextColor={t.textoTer}
              selectionColor={t.tinte}
              multiline
              maxLength={MAX_DESCRIPCION}
              textAlignVertical="top"
              accessibilityLabel="Descripción del producto"
              style={[
                tipo.cuerpo,
                s.texto,
                { color: t.texto },
                Platform.OS === "web" && ({ outlineStyle: "none" } as object),
              ]}
            />
            {valor.length > MAX_DESCRIPCION * 0.8 ? (
              <Text style={[tipo.leyenda, { color: t.textoSec, textAlign: "right" }]}>
                {valor.length} / {MAX_DESCRIPCION}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={s.caja}>
            <Text style={[tipo.cuerpo, { color: borrador ? t.texto : t.textoSec }]}>
              {borrador || "Este producto todavía no tiene descripción."}
            </Text>
          </View>
        )}

        {puedeIa && editable ? (
          <Fila
            titulo={
              pidiendo
                ? "La IA está escribiendo…"
                : modo === "mejorar"
                  ? "Sugerir cambios con IA"
                  : "Escribir con IA"
            }
            subtitulo={sinNombre ? "Primero ponle un nombre al producto" : undefined}
            izquierda={<Icono sf="sparkles" ion="sparkles" size={20} color={t.violeta} />}
            derecha={pidiendo ? <ActivityIndicator color={t.textoSec} /> : undefined}
            tinte={!sinNombre && nivel !== "lleno"}
            apagada={sinNombre || nivel === "lleno"}
            onPress={sinNombre || pidiendo || nivel === "lleno" ? undefined : pedir}
          />
        ) : null}
      </Grupo>

      {sugerencia ? (
        <Grupo
          titulo="Sugerencia de la IA"
          pie="Revísala antes de usarla: la IA puede equivocarse. Se guarda recién cuando guardas el producto."
        >
          <View style={s.caja}>
            <Text style={[tipo.cuerpo, { color: t.texto }]} selectable>
              {sugerencia.descripcion}
            </Text>
          </View>
          {sugerencia.tipo ? <Fila titulo="Tipo de producto" valor={sugerencia.tipo} /> : null}
          {categoriaNueva ? (
            <Fila
              titulo={`Pasar a “${categoriaNueva}”`}
              subtitulo="La categoría que sugiere la IA"
              tinte
              onPress={() => onCategoriaSugerida?.(categoriaNueva)}
            />
          ) : null}
          <Fila
            titulo={modo === "mejorar" ? "Reemplazar mi texto" : "Usar esta descripción"}
            izquierda={<Icono sf="checkmark" ion="checkmark" size={18} color={t.tinte} />}
            tinte
            onPress={usar}
          />
          <Fila titulo="Probar otra vez" tinte onPress={pidiendo ? undefined : pedir} />
          <Fila titulo="Descartar" destructiva onPress={() => setSugerencia(null)} />
        </Grupo>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  caja: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  texto: { minHeight: 88, paddingVertical: 0 },
});
