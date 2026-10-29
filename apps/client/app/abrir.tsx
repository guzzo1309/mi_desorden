import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useAcciones, useSesion } from "@/lib/store";

/**
 * midesorden://abrir?inv=<id>: el botón del correo de invitación. Deja ese
 * inventario como activo y va a la tab Inventario.
 */
export default function Abrir() {
  const { inv } = useLocalSearchParams<{ inv?: string }>();
  const { seleccionarInventario } = useSesion();
  const { refrescar } = useAcciones();

  useEffect(() => {
    if (!inv) return;
    seleccionarInventario(inv);
    // Recién invitado: puede que la lista todavía no lo tenga.
    void refrescar().catch(() => {});
    // Una vez por enlace: las funciones del store cambian en cada render.
  }, [inv]);

  return <Redirect href="/(tabs)/(inventario)" />;
}
