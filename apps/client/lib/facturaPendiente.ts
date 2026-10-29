/**
 * La foto de la factura que acaba de sacar la cámara (/factura-camara). La pantalla
 * de la factura la toma al volver y la lee. Se pasa así y no por la URL del route.
 */
let uri: string | null = null;

export const facturaPendiente = {
  poner(nueva: string) {
    uri = nueva;
  },
  /** La devuelve y la borra: se usa una sola vez. */
  tomar(): string | null {
    const u = uri;
    uri = null;
    return u;
  },
};
