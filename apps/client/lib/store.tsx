import { InventarioProvider } from "./estado/inventario";
import { SesionProvider } from "./estado/sesion";
import { SolicitudesProvider } from "./estado/solicitudes";

/**
 * Estado de la app, en tres hooks según lo que necesite cada pantalla:
 *
 *   useSesion()      quién soy, si soy admin, inventario abierto, preferencias, login
 *   useInventario()  inventarios, productos, categorías y permisos (lo que se ve)
 *   useAcciones()    crear, editar, invitar… (estable: no redibuja con los datos)
 *   useSolicitudes() pedidos de los lectores al owner y a los editores
 *
 * Una pantalla importa solo lo que usa: así un cambio de stock o de presencia no
 * redibuja el login ni el layout raíz.
 */
export { useAcciones, useInventario } from "./estado/inventario";
export { useSesion } from "./estado/sesion";
export { useSolicitudes } from "./estado/solicitudes";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <SesionProvider>
      <InventarioProvider>
        <SolicitudesProvider>{children}</SolicitudesProvider>
      </InventarioProvider>
    </SesionProvider>
  );
}
