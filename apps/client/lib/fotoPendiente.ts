import { MAX_FOTOS } from "@/lib/fotos";

/**
 * Las fotos de un producto que todavía no se guardó: la que sacó la cámara
 * cuando no reconoció el producto, más las que se sacan en el formulario (hasta
 * MAX_FOTOS). Se pasan así (y no por la URL) porque el base64 es enorme. El
 * formulario las sube al guardar: la primera es la principal y las otras, extras.
 */
export interface Foto {
  uri: string;
  base64: string;
}

let fotos: Foto[] = [];

export const fotoPendiente = {
  /** Deja solo esta (la foto de la cámara al agregar un producto nuevo). */
  poner(foto: Foto) {
    fotos = [foto];
  },
  /** La primera, o null. */
  ver(): Foto | null {
    return fotos[0] ?? null;
  },
  lista(): Foto[] {
    return [...fotos];
  },
  /** Suma una foto; si ya hay MAX_FOTOS, no hace nada. */
  agregar(foto: Foto) {
    if (fotos.length < MAX_FOTOS) fotos = [...fotos, foto];
  },
  quitar(indice: number) {
    fotos = fotos.filter((_, i) => i !== indice);
  },
  /** La primera y vacía la lista. */
  tomar(): Foto | null {
    const f = fotos[0] ?? null;
    fotos = [];
    return f;
  },
  descartar() {
    fotos = [];
  },
};
