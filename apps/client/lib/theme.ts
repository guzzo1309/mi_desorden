import type { LedColor } from "@mi-desorden/core";
import { useColorScheme } from "react-native";

/** Colores de sistema de iOS (HIG), en claro y oscuro. */
const claro = {
  fondo: "#F2F2F7",
  celda: "#FFFFFF",
  celdaAlta: "#F2F2F7",
  texto: "#000000",
  textoSec: "rgba(60,60,67,0.6)",
  textoTer: "rgba(60,60,67,0.3)",
  separador: "rgba(60,60,67,0.18)",
  relleno: "rgba(120,120,128,0.12)",
  tinte: "#FF9500",
  verde: "#34C759",
  rojo: "#FF3B30",
  amarillo: "#FFCC00",
  azul: "#007AFF",
  violeta: "#AF52DE",
};

const oscuro: typeof claro = {
  fondo: "#000000",
  celda: "#1C1C1E",
  celdaAlta: "#2C2C2E",
  texto: "#FFFFFF",
  textoSec: "rgba(235,235,245,0.6)",
  textoTer: "rgba(235,235,245,0.3)",
  separador: "rgba(84,84,88,0.6)",
  relleno: "rgba(120,120,128,0.24)",
  tinte: "#FF9F0A",
  verde: "#30D158",
  rojo: "#FF453A",
  amarillo: "#FFD60A",
  azul: "#0A84FF",
  violeta: "#BF5AF2",
};

export type Tema = typeof claro & { oscuro: boolean };

export function useTema(): Tema {
  const esOscuro = useColorScheme() === "dark";
  return { ...(esOscuro ? oscuro : claro), oscuro: esOscuro };
}

export function colorLed(t: Tema, c: LedColor) {
  return { verde: t.verde, azul: t.azul, rojo: t.rojo, amarillo: t.amarillo, violeta: t.violeta }[
    c
  ];
}

/** Escala tipográfica de iOS. */
export const tipo = {
  tituloGrande: { fontSize: 34, fontWeight: "700", letterSpacing: 0.4 },
  titulo2: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3 },
  titulo3: { fontSize: 20, fontWeight: "600", letterSpacing: -0.4 },
  destacado: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
  cuerpo: { fontSize: 17, letterSpacing: -0.4 },
  subtitulo: { fontSize: 15, letterSpacing: -0.2 },
  nota: { fontSize: 13, letterSpacing: -0.1 },
  leyenda: { fontSize: 12 },
} as const;
