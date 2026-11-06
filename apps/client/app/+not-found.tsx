import { Redirect } from "expo-router";
import { useSesion } from "@/lib/store";

/**
 * Red de seguridad: si la app se abre en una ruta que todavía no está disponible
 * (por ejemplo "/" al arrancar, antes de saber quién eres, o con pestañas ocultas
 * según tu rol), te manda a donde corresponde en vez de mostrar "Unmatched Route".
 */
export default function NoEncontrada() {
  const { usuario, esAdmin, debeCambiarClave, recuperando } = useSesion();

  if (!usuario) return <Redirect href="/login" />;
  if (recuperando) return <Redirect href="/recuperar" />;
  if (debeCambiarClave) return <Redirect href="/clave-inicial" />;
  return <Redirect href={esAdmin ? "/(tabs)/(resumen)" : "/(tabs)/(inventario)"} />;
}
