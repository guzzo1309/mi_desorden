/**
 * Rango [desde, hasta] de un año y mes opcional, para los filtros del panel.
 * `hasta` incluye el último milisegundo del período porque las RPC usan
 * `between`, que es inclusivo en los dos extremos.
 */
export function rangoDe(anio: number, mes: number | null): { desde: string; hasta: string } {
  const desde = mes ? new Date(anio, mes - 1, 1) : new Date(anio, 0, 1);
  const hasta = mes ? new Date(anio, mes, 1) : new Date(anio + 1, 0, 1);
  return { desde: desde.toISOString(), hasta: new Date(hasta.getTime() - 1).toISOString() };
}