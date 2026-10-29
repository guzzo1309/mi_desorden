/**
 * Funciones puras para comparar la foto de la cámara con las fotos de los
 * productos (hasta 3 por producto). Sin React Native para poder testearlas.
 */

/**
 * Aplana producto → huellas[] en las referencias que espera el módulo nativo
 * (id → huella): cada foto es una referencia con la clave `producto#n`.
 */
export function aplanarHuellas(huellas: Record<string, string[]>): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const [id, hs] of Object.entries(huellas)) {
    hs.forEach((h, i) => (salida[`${id}#${i}`] = h));
  }
  return salida;
}

/** De las distancias por foto (`producto#n`), la más chica (la foto más parecida) de cada producto. */
export function mejorDistancia(distancias: Record<string, number>): Record<string, number> {
  const salida: Record<string, number> = {};
  for (const [clave, d] of Object.entries(distancias)) {
    const id = clave.includes("#") ? clave.slice(0, clave.lastIndexOf("#")) : clave;
    if (salida[id] === undefined || d < salida[id]!) salida[id] = d;
  }
  return salida;
}
