import { darkTheme, lightTheme, palette } from "@mi-desorden/core";
import { Platform, useColorScheme } from "react-native";

export type EsquemaTema = {
  fondo: string;
  celda: string;
  celdaAlta: string;
  texto: string;
  textoSec: string;
  textoTer: string;
  separador: string;
  relleno: string;
  tinte: string;
  sobreTinte: string;
  kraft: string;
  acento: string;
  enVivo: string;
  verde: string;
  rojo: string;
  amarillo: string;
  azul: string;
  violeta: string;
};

/**
 * Tema de la aplicación: integra la paleta de identidad visual de mi_desorden
 * (Desorden Blue, Scan Amber, Realtime Teal, Shelf Gray) con las semánticas de la app.
 */
const claro: EsquemaTema = {
  fondo: palette.neutral[50],
  celda: lightTheme.surface,
  celdaAlta: "#F3F4F6",
  texto: palette.neutral[900],
  textoSec: "rgba(17,24,39,0.6)",
  textoTer: "rgba(17,24,39,0.3)",
  separador: palette.neutral[200],
  relleno: "rgba(17,24,39,0.06)",
  tinte: palette.primary[700],
  sobreTinte: "#FFFFFF",
  kraft: "#B07A44",
  acento: palette.accent[600],
  enVivo: palette.live[600],
  verde: palette.semantic.success,
  rojo: palette.semantic.error,
  amarillo: palette.semantic.warning,
  azul: palette.primary[500],
  violeta: "#8B5CF6",
};

const oscuro: EsquemaTema = {
  fondo: palette.neutral[950],
  celda: palette.neutral[800],
  celdaAlta: "#2A303C",
  texto: darkTheme.text,
  textoSec: "rgba(255,255,255,0.6)",
  textoTer: "rgba(255,255,255,0.3)",
  separador: palette.neutral[800],
  relleno: "rgba(255,255,255,0.08)",
  tinte: palette.primary[500],
  sobreTinte: "#FFFFFF",
  kraft: "#C98B4E",
  acento: palette.accent[400],
  enVivo: palette.live[600],
  verde: palette.semantic.success,
  rojo: palette.semantic.error,
  amarillo: palette.semantic.warning,
  azul: palette.primary[500],
  violeta: "#A78BFA",
};

export type Tema = EsquemaTema & { oscuro: boolean };

export function useTema(): Tema {
  const esOscuro = useColorScheme() === "dark";
  return { ...(esOscuro ? oscuro : claro), oscuro: esOscuro };
}

export { darkTheme, lightTheme, palette };

/** Letra de marca para títulos: SF Pro Rounded en iOS, la del sistema en el resto. */
export const fuenteMarca = Platform.select({ ios: "ui-rounded", default: undefined });

/** Escala tipográfica de iOS; los títulos van en la letra redondeada de la marca. */
export const tipo = {
  tituloGrande: { fontSize: 34, fontWeight: "700", letterSpacing: 0.4, fontFamily: fuenteMarca },
  titulo2: { fontSize: 22, fontWeight: "700", letterSpacing: -0.3, fontFamily: fuenteMarca },
  titulo3: { fontSize: 20, fontWeight: "600", letterSpacing: -0.4, fontFamily: fuenteMarca },
  destacado: { fontSize: 17, fontWeight: "600", letterSpacing: -0.4 },
  cuerpo: { fontSize: 17, letterSpacing: -0.4 },
  subtitulo: { fontSize: 15, letterSpacing: -0.2 },
  nota: { fontSize: 13, letterSpacing: -0.1 },
  leyenda: { fontSize: 12 },
} as const;
