import type { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import type { SFSymbol } from "@/components/ui";

/**
 * Íconos para las categorías: SF Symbols en iOS y su par de Ionicons en Android y
 * web. Se guarda la clave (categorias.icono), así se pueden sumar íconos sin tocar
 * la base. Agrupados por rubro para encontrarlos rápido, 6 por rubro (una fila; en
 * General la carpeta ocupa el sexto lugar).
 */

export interface IconoCategoriaDef {
  clave: string;
  etiqueta: string;
  sf: SFSymbol;
  ion: ComponentProps<typeof Ionicons>["name"];
}

export interface GrupoIconos {
  titulo: string;
  iconos: IconoCategoriaDef[];
}

export const GRUPOS_ICONOS: GrupoIconos[] = [
  {
    titulo: "General",
    iconos: [
      { clave: "caja", etiqueta: "Caja", sf: "shippingbox.fill", ion: "cube" },
      { clave: "archivo", etiqueta: "Archivo", sf: "archivebox.fill", ion: "archive" },
      { clave: "etiqueta", etiqueta: "Etiqueta", sf: "tag.fill", ion: "pricetag" },
      { clave: "carrito", etiqueta: "Carrito", sf: "cart.fill", ion: "cart" },
      { clave: "bolsa", etiqueta: "Bolsa", sf: "bag.fill", ion: "bag-handle" },
    ],
  },
  {
    titulo: "Oficina",
    iconos: [
      { clave: "documentos", etiqueta: "Documentos", sf: "doc.text.fill", ion: "document-text" },
      { clave: "lapiz", etiqueta: "Útiles", sf: "pencil", ion: "pencil" },
      { clave: "clip", etiqueta: "Papelería", sf: "paperclip", ion: "attach" },
      { clave: "libro", etiqueta: "Libros", sf: "book.fill", ion: "book" },
      { clave: "impresora", etiqueta: "Impresión", sf: "printer.fill", ion: "print" },
      { clave: "tijeras", etiqueta: "Tijeras", sf: "scissors", ion: "cut" },
    ],
  },
  {
    titulo: "Tecnología",
    iconos: [
      { clave: "computador", etiqueta: "Computación", sf: "desktopcomputer", ion: "desktop" },
      { clave: "telefono", etiqueta: "Teléfonos", sf: "iphone", ion: "phone-portrait" },
      { clave: "audio", etiqueta: "Audio", sf: "headphones", ion: "headset" },
      { clave: "camara", etiqueta: "Fotografía", sf: "camera.fill", ion: "camera" },
      { clave: "electricidad", etiqueta: "Electricidad", sf: "bolt.fill", ion: "flash" },
      { clave: "bateria", etiqueta: "Baterías", sf: "battery.100", ion: "battery-full" },
    ],
  },
  {
    titulo: "Herramientas",
    iconos: [
      {
        clave: "herramientas",
        etiqueta: "Herramientas",
        sf: "wrench.and.screwdriver.fill",
        ion: "construct",
      },
      { clave: "martillo", etiqueta: "Martillos", sf: "hammer.fill", ion: "hammer" },
      { clave: "pintura", etiqueta: "Pintura", sf: "paintbrush.fill", ion: "brush" },
      { clave: "llaves", etiqueta: "Cerrajería", sf: "key.fill", ion: "key" },
      { clave: "iluminacion", etiqueta: "Iluminación", sf: "lightbulb.fill", ion: "bulb" },
      { clave: "auto", etiqueta: "Automotriz", sf: "car.fill", ion: "car" },
    ],
  },
  {
    titulo: "Alimentos y limpieza",
    iconos: [
      { clave: "bebidas", etiqueta: "Bebidas", sf: "cup.and.saucer.fill", ion: "cafe" },
      { clave: "comida", etiqueta: "Comida", sf: "fork.knife", ion: "restaurant" },
      { clave: "frio", etiqueta: "Congelados", sf: "snowflake", ion: "snow" },
      { clave: "agua", etiqueta: "Agua", sf: "drop.fill", ion: "water" },
      { clave: "limpieza", etiqueta: "Limpieza", sf: "sparkles", ion: "sparkles" },
      { clave: "gas", etiqueta: "Combustible", sf: "flame.fill", ion: "flame" },
    ],
  },
  {
    titulo: "Hogar y personal",
    iconos: [
      { clave: "hogar", etiqueta: "Hogar", sf: "house.fill", ion: "home" },
      { clave: "ropa", etiqueta: "Ropa", sf: "tshirt.fill", ion: "shirt" },
      { clave: "salud", etiqueta: "Salud", sf: "cross.case.fill", ion: "medkit" },
      { clave: "plantas", etiqueta: "Plantas", sf: "leaf.fill", ion: "leaf" },
      { clave: "mascotas", etiqueta: "Mascotas", sf: "pawprint.fill", ion: "paw" },
      { clave: "regalos", etiqueta: "Regalos", sf: "gift.fill", ion: "gift" },
    ],
  },
  {
    titulo: "Ocio",
    iconos: [
      { clave: "deportes", etiqueta: "Deportes", sf: "figure.run", ion: "football" },
      { clave: "juegos", etiqueta: "Juegos", sf: "gamecontroller.fill", ion: "game-controller" },
      { clave: "musica", etiqueta: "Música", sf: "music.note", ion: "musical-notes" },
      { clave: "bicicletas", etiqueta: "Bicicletas", sf: "bicycle", ion: "bicycle" },
      { clave: "viajes", etiqueta: "Viajes", sf: "airplane", ion: "airplane" },
      { clave: "mundo", etiqueta: "Importados", sf: "globe", ion: "globe" },
    ],
  },
];

const POR_CLAVE = new Map(GRUPOS_ICONOS.flatMap((g) => g.iconos).map((i) => [i.clave, i]));

/** El ícono de esa clave; undefined si no existe (o es de una versión más nueva de la app). */
export const iconoPorClave = (clave: string | null | undefined) =>
  clave ? POR_CLAVE.get(clave) : undefined;
