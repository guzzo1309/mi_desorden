/**
 * Logs de desarrollo. Salen en la terminal de Metro (la pestaña client#dev de
 * `bun dev`) con una etiqueta y los ms desde que se creó el logger:
 *
 *   [optimizar +412ms] bajada: 2.1 MB
 *
 * En producción (__DEV__ falso) no hacen nada: no ensucian la consola ni filtran datos.
 */
export interface Log {
  info: (...datos: unknown[]) => void;
  warn: (...datos: unknown[]) => void;
  error: (...datos: unknown[]) => void;
}

const nada = () => {};

export function crearLog(etiqueta: string): Log {
  if (!__DEV__) return { info: nada, warn: nada, error: nada };
  const inicio = Date.now();
  const prefijo = () => `[${etiqueta} +${Date.now() - inicio}ms]`;
  return {
    info: (...d) => console.log(prefijo(), ...d),
    warn: (...d) => console.warn(prefijo(), ...d),
    error: (...d) => console.error(prefijo(), ...d),
  };
}

/** 2_100_000 → "2.1 MB"; para leer tamaños de archivo en los logs. */
export function tamano(bytes: number | null | undefined): string {
  if (bytes == null) return "?";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
