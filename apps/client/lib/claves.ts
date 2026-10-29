/** Sin 0/O, 1/l/I: la contraseña temporal se dicta o se lee en voz alta. */
const ALFABETO = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function aleatorio(max: number): number {
  const cripto = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } })
    .crypto;
  if (cripto?.getRandomValues) {
    // Sin sesgo: se descartan los valores que no entran parejos en el rango.
    const limite = Math.floor(0x1_0000_0000 / max) * max;
    const buf = new Uint32Array(1);
    do cripto.getRandomValues(buf);
    while (buf[0]! >= limite);
    return buf[0]! % max;
  }
  return Math.floor(Math.random() * max);
}

/** Contraseña temporal legible, de `largo` caracteres (mínimo 8). */
export function generarClave(largo = 10): string {
  const n = Math.max(8, largo);
  return Array.from({ length: n }, () => ALFABETO[aleatorio(ALFABETO.length)]).join("");
}

/** Lo que el owner le pasa al empleado: correo, contraseña temporal y qué hacer. */
export function textoCredenciales(c: {
  nombre: string;
  email: string;
  clave: string;
  inventarios: string[];
}): string {
  const donde =
    c.inventarios.length === 1
      ? `«${c.inventarios[0]}»`
      : c.inventarios.map((n) => `«${n}»`).join(", ");
  return [
    `Hola ${c.nombre}, te agregué a ${donde} en MI DESORDEN.`,
    "",
    `Correo: ${c.email}`,
    `Contraseña temporal: ${c.clave}`,
    "",
    "Cuando entres por primera vez vas a tener que elegir tu propia contraseña.",
  ].join("\n");
}
