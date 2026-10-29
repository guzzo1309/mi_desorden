import type { Categoria } from "@mi-desorden/core";
import {
  Button,
  Host,
  HStack,
  Image as ImagenSF,
  Menu,
  Picker,
  Section,
  Text as TextoSF,
} from "@/components/swiftui";
import {
  background,
  disabled,
  font,
  foregroundStyle,
  frame,
  glassEffect,
  lineLimit,
  pickerStyle,
  shapes,
  tag,
} from "@/components/swiftui";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Alert, Platform, Pressable, Text } from "react-native";
import { Icono, tocar } from "@/components/ui";
import { BotonRedondo } from "@/components/vistas";
import { opcionesCategoria, rutaCategoria } from "@/lib/categorias";
import { tipo, useTema } from "@/lib/theme";
import { menuWeb } from "@/web/dialogos";

/**
 * Menús nativos de iOS (SwiftUI, como en Notas o Archivos). En Android y web
 * caen a un Alert con las mismas opciones.
 */

/** iOS 26+: los botones redondos son Liquid Glass; antes, un círculo liso. */
const GLASS = Platform.OS === "ios" && isLiquidGlassAvailable();

/** El "+" del encabezado: un círculo de 44 pt, como los botones de la barra de iOS 26. */
const BOTON = 44;

type SFSymbol = NonNullable<Parameters<typeof Button>[0]["systemImage"]>;

export interface Accion {
  etiqueta: string;
  sf: SFSymbol;
  onPress: () => void;
  destructiva?: boolean;
  deshabilitada?: boolean;
}

/** Grupos separados por una línea, como en los menús del sistema. */
type Grupos = Accion[][];

function itemsMenu(grupos: Grupos) {
  return grupos
    .filter((g) => g.length)
    .map((g, i) => (
      <Section key={i}>
        {g.map((a) => (
          <Button
            key={a.etiqueta}
            label={a.etiqueta}
            systemImage={a.sf}
            role={a.destructiva ? "destructive" : "default"}
            modifiers={a.deshabilitada ? [disabled(true)] : []}
            onPress={a.onPress}
          />
        ))}
      </Section>
    ));
}

function alertMenu(titulo: string, grupos: Grupos) {
  if (Platform.OS === "web") {
    return menuWeb(
      titulo,
      grupos.flat().map((a) => ({
        texto: a.etiqueta,
        onPress: a.onPress,
        destructiva: a.destructiva,
        deshabilitada: a.deshabilitada,
      })),
    );
  }

  Alert.alert(titulo, undefined, [
    ...grupos.flat().map((a) => ({
      text: a.etiqueta,
      style: a.destructiva ? ("destructive" as const) : ("default" as const),
      onPress: a.deshabilitada ? undefined : a.onPress,
    })),
    { text: "Cancelar", style: "cancel" as const },
  ]);
}

/** El "+" redondo del encabezado, con un menú (ej. Nuevo producto / Nueva categoría). */
export function MenuMas({ etiqueta, grupos }: { etiqueta: string; grupos: Grupos }) {
  const t = useTema();
  if (Platform.OS !== "ios") {
    return (
      <BotonRedondo
        sf="plus"
        ion="add"
        etiqueta={etiqueta}
        onPress={() => alertMenu(etiqueta, grupos)}
      />
    );
  }
  return (
    <Host matchContents>
      <Menu
        label={
          <ImagenSF
            systemName="plus"
            color={t.tinte}
            modifiers={[
              font({ size: 20, weight: "semibold" }),
              frame({ width: BOTON, height: BOTON }),
              GLASS
                ? glassEffect({ glass: { variant: "regular", interactive: true }, shape: "circle" })
                : background(t.celda, shapes.circle()),
            ]}
          />
        }
      >
        {itemsMenu(grupos)}
      </Menu>
    </Host>
  );
}

/** "•••" de una carpeta: renombrar, subcategoría, eliminar… */
export function MenuPuntos({ titulo, grupos }: { titulo: string; grupos: Grupos }) {
  const t = useTema();
  if (Platform.OS !== "ios") {
    return (
      <Pressable
        // En web un rol "button" es un <button>, y el "•••" va dentro de la fila de la
        // carpeta, que ya es otro <button>: HTML no deja anidarlos (error de React).
        accessibilityRole={Platform.OS === "web" ? undefined : "button"}
        accessibilityLabel={`Opciones de ${titulo}`}
        hitSlop={10}
        onPress={() => (tocar(), alertMenu(titulo, grupos))}
      >
        <Icono sf="ellipsis.circle" ion="ellipsis-horizontal-circle" size={22} color={t.tinte} />
      </Pressable>
    );
  }
  return (
    <Host matchContents>
      <Menu
        label={
          <ImagenSF
            systemName="ellipsis.circle"
            color={t.tinte}
            modifiers={[font({ size: 20 }), frame({ width: 36, height: 36 })]}
          />
        }
      >
        {itemsMenu(grupos)}
      </Menu>
    </Host>
  );
}

/**
 * Elegir la categoría de un producto: muestra la elegida ("Bebidas › Gaseosas")
 * y al tocar abre la lista, con "Nueva categoría…" al final.
 */
export function MenuCategoria({
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
  const opciones = opcionesCategoria(categorias);
  const actual = rutaCategoria(categorias, valor) || "Elegir";

  if (!editable) {
    return <Text style={[tipo.cuerpo, { color: t.textoSec }]}>{actual}</Text>;
  }

  if (Platform.OS !== "ios") {
    return (
      <Pressable
        hitSlop={8}
        onPress={() => {
          tocar();
          alertMenu("Categoría", [
            opciones.map((o) => ({
              etiqueta: o.etiqueta,
              sf: "folder" as const,
              onPress: () => onCambio(o.id),
            })),
            [{ etiqueta: "Nueva categoría…", sf: "folder.badge.plus", onPress: onNueva }],
          ]);
        }}
      >
        <Text style={[tipo.cuerpo, { color: valor ? t.textoSec : t.tinte }]}>{actual}</Text>
      </Pressable>
    );
  }

  return (
    <Host matchContents>
      <Menu
        label={
          <HStack spacing={4}>
            <TextoSF
              modifiers={[
                font({ size: 17 }),
                foregroundStyle(valor ? t.textoSec : t.tinte),
                lineLimit(1),
              ]}
            >
              {actual}
            </TextoSF>
            <ImagenSF
              systemName="chevron.up.chevron.down"
              color={t.textoTer}
              modifiers={[font({ size: 13, weight: "semibold" })]}
            />
          </HStack>
        }
      >
        <Picker
          label="Categoría"
          selection={valor}
          onSelectionChange={(id: string | null) => id && onCambio(id)}
          modifiers={[pickerStyle("inline")]}
        >
          {opciones.map((o) => (
            <TextoSF key={o.id} modifiers={[tag(o.id)]}>
              {o.etiqueta}
            </TextoSF>
          ))}
        </Picker>
        <Section>
          <Button label="Nueva categoría…" systemImage="folder.badge.plus" onPress={onNueva} />
        </Section>
      </Menu>
    </Host>
  );
}
