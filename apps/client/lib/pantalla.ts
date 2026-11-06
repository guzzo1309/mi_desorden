import { Platform, useWindowDimensions } from "react-native";

export const ANCHO_ESCRITORIO = 900;

export function useEsAncho(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === "web" && width >= ANCHO_ESCRITORIO;
}
