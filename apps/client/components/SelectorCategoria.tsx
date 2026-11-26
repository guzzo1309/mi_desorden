import type { Categoria } from "@mi-desorden/core";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconoCategoria, useEstiloTitulo } from "@/components/EstiloCategoria";
import { Icono, tocar } from "@/components/ui";
import { rutaCategoria } from "@/lib/categorias";
import { tipo, useTema, fuenteMarca } from "@/lib/theme";

const porNombre = (a: Categoria, b: Categoria) =>
  a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });

/**
 * Elegir la categoría de un producto. Una hoja propia en vez de un menú del sistema:
 * los menús nativos no muestran la imagen, la letra ni el color que eligió el owner.
 */
export function SelectorCategoria({
  categorias,
  valor,
  onCambio,
  onNueva,
  editable = true,
}: {
  categorias: Categoria[];
  valor: string | null;
  onCambio: (id: string) => void;
  onNueva: () => void;
  editable?: boolean;
}) {
  const t = useTema();
  const insets = useSafeAreaInsets();
  const [abierto, setAbierto] = useState(false);
  const elegida = valor ? categorias.find((c) => c.id === valor) : undefined;
  const estiloElegida = useEstiloTitulo(elegida ?? {}, t.textoSec);

  const principales = categorias.filter((c) => !c.padre_id).sort(porNombre);
  const hijasDe = (id: string) => categorias.filter((c) => c.padre_id === id).sort(porNombre);

  function elegir(id: string) {
    tocar();
    onCambio(id);
    setAbierto(false);
  }

  function nueva() {
    tocar();
    setAbierto(false);
    onNueva();
  }

  const etiqueta = elegida ? (
    <View style={s.actual}>
      <IconoCategoria categoria={elegida} tam={16} colorBase={t.textoSec} />
      <Text style={[tipo.cuerpo, { flexShrink: 1 }, estiloElegida]} numberOfLines={1}>
        {rutaCategoria(categorias, valor)}
      </Text>
    </View>
  ) : (
    <Text style={[tipo.cuerpo, { color: editable ? t.tinte : t.textoSec }]}>Elegir</Text>
  );

  if (!editable) return etiqueta;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Categoría: ${elegida ? rutaCategoria(categorias, valor) : "sin elegir"}`}
        hitSlop={8}
        onPress={() => (tocar(), setAbierto(true))}
        style={({ pressed }) => [s.boton, pressed && { opacity: 0.6 }]}
      >
        {etiqueta}
        <Icono
          sf="chevron.up.chevron.down"
          ion="chevron-expand"
          size={13}
          color={t.textoTer}
          weight="semibold"
        />
      </Pressable>

      <Modal
        visible={abierto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierto(false)}
      >
        <View style={{ flex: 1, backgroundColor: t.fondo }}>
          <View style={s.cabecera}>
            <Text style={[s.titulo, { color: t.texto }]}>Categoría</Text>
            <Pressable
              accessibilityRole="button"
              hitSlop={10}
              onPress={() => setAbierto(false)}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={[tipo.cuerpo, { color: t.tinte, fontWeight: "600" }]}>Listo</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          >
            <View style={[s.tarjeta, { backgroundColor: t.celda }]}>
              {principales.map((p, i) => (
                <View key={p.id}>
                  {i > 0 ? <View style={[s.linea, { backgroundColor: t.separador }]} /> : null}
                  <Opcion categoria={p} elegida={p.id === valor} onPress={() => elegir(p.id)} />
                  {hijasDe(p.id).map((h) => (
                    <View key={h.id}>
                      <View style={[s.linea, { backgroundColor: t.separador, marginLeft: 52 }]} />
                      <Opcion
                        categoria={h}
                        sub
                        elegida={h.id === valor}
                        onPress={() => elegir(h.id)}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={nueva}
              style={({ pressed }) => [
                s.tarjeta,
                s.fila,
                { backgroundColor: pressed ? t.celdaAlta : t.celda, marginTop: 20 },
              ]}
            >
              <Icono sf="folder.badge.plus" ion="add-circle-outline" size={22} color={t.tinte} />
              <Text style={[tipo.cuerpo, { color: t.tinte }]}>Nueva categoría…</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Opcion({
  categoria,
  sub,
  elegida,
  onPress,
}: {
  categoria: Categoria;
  sub?: boolean;
  elegida: boolean;
  onPress: () => void;
}) {
  const t = useTema();
  const estilo = useEstiloTitulo(categoria);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: elegida }}
      onPress={onPress}
      style={({ pressed }) => [
        s.fila,
        sub && { paddingLeft: 36 },
        pressed && { backgroundColor: t.relleno },
      ]}
    >
      <IconoCategoria
        categoria={categoria}
        tam={sub ? 18 : 22}
        colorBase={sub ? t.textoSec : t.tinte}
      />
      <Text
        style={[tipo.cuerpo, { flex: 1, fontWeight: sub ? "400" : "600" }, estilo]}
        numberOfLines={1}
      >
        {categoria.nombre}
      </Text>
      {elegida ? (
        <Icono sf="checkmark" ion="checkmark" size={17} color={t.tinte} weight="semibold" />
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  boton: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  actual: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
  },
  titulo: { fontSize: 20, fontWeight: "700", fontFamily: fuenteMarca, letterSpacing: -0.3 },
  tarjeta: { borderRadius: 26, overflow: "hidden" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  linea: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
});
