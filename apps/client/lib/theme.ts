import { Platform, useColorScheme } from "react-native";

/**
 * Marca "Cinta de embalar": papel kraft, cinta ámbar y tinta café.
 * Los colores de estado (verde, rojo, amarillo, azul, violeta) siguen siendo
 * los de sistema de iOS para que se lean igual que en el resto del teléfono.
 */
const claro = {
  fondo: "#F6F0E6",
  celda: "#FFFCF7",
  celdaAlta: "#EFE6D8",
  texto: "#2A1D10",
  textoSec: "rgba(74,52,30,0.62)",
  textoTer: "rgba(74,52,30,0.32)",
  separador: "rgba(74,52,30,0.16)",
  relleno: "rgba(150,110,70,0.14)",
  /** Color de marca: botones, enlaces, pestaña activa. */
  tinte: "#C46A14",
  /** Texto e íconos encima de `tinte`. */
  sobreTinte: "#FFF8EE",
  /** Kraft: superficies de marca secundarias (insignias, ilustraciones). */
  kraft: "#B07A44",
  verde: "#34C759",
  rojo: "#FF3B30",
  amarillo: "#FFCC00",
  azul: "#007AFF",
  violeta: "#AF52DE",
};

const oscuro: typeof claro = {
  fondo: "#0F0D0B",
  celda: "#1E1A16",
  celdaAlta: "#2A241E",
  texto: "#F5EBDD",
  textoSec: "rgba(245,235,221,0.6)",
  textoTer: "rgba(245,235,221,0.3)",
  separador: "rgba(140,115,90,0.4)",
  relleno: "rgba(170,135,100,0.2)",
  tinte: "#F2A33A",
  sobreTinte: "#3A2208",
  kraft: "#C98B4E",
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
