/** "hace 3 min", "hace 2 h", o la fecha si es vieja. */
export function haceCuanto(iso: string, ahora = Date.now()) {
  const seg = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 1000));
  if (seg < 10) return "recién";
  if (seg < 60) return `hace ${seg} s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

export function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** "29 oct 2026". */
export function fechaCorta(iso: string) {
  return new Date(iso).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Las 00:00 de hoy en la hora del teléfono, como ISO (para contar lo de "hoy"). */
export function inicioDeHoy(ahora = new Date()): string {
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString();
}
