/**
 * Un lugar escrito todo en mayúsculas ("ESCRITORIO 2") se muestra con mayúscula
 * inicial ("Escritorio 2"): las mayúsculas sostenidas se leen como un grito y
 * cuestan más de leer. Si ya trae minúsculas, se respeta como lo escribieron.
 */
export function nombreLugar(lugar: string): string {
  const limpio = lugar.trim();
  if (!limpio || limpio !== limpio.toUpperCase() || !/\p{Lu}/u.test(limpio)) return limpio;
  const bajo = limpio.toLocaleLowerCase("es");
  return bajo.charAt(0).toLocaleUpperCase("es") + bajo.slice(1);
}

/** ¿Cambió hace menos de un día? Solo entonces vale la pena decir "hace X". */
export function esReciente(iso: string, ahora = Date.now()): boolean {
  return ahora - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}
