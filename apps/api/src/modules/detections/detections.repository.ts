import type { Detection } from "@mi-desorden/core";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { SupabaseRestService } from "../../shared/supabase/supabase-rest.service";

/**
 * Escribe en `detecciones`. Si Supabase no está configurado (tests, `bun test`
 * sin Doppler) cae a un array en memoria para no romper la suite.
 */
@Injectable()
export class DetectionsRepository {
  private readonly memoria: Detection[] = [];

  constructor(private readonly supabase: SupabaseRestService) {}

  async listar(
    usuarioId: string,
    inventarioId: string | undefined,
    auth: string,
  ): Promise<Detection[]> {
    if (!this.supabase.estaConfigurado) {
      return this.memoria.filter(
        (d) => d.usuario_id === usuarioId && (!inventarioId || d.inventario_id === inventarioId),
      );
    }

    const filtros = ["select=*", "order=creada_en.desc"];
    if (inventarioId) filtros.push(`inventario_id=eq.${inventarioId}`);

    return this.supabase.seleccionar<Detection>("detecciones", filtros.join("&"), auth);
  }

  async guardar(detection: Detection, auth: string): Promise<Detection> {
    if (!this.supabase.estaConfigurado) {
      this.memoria.unshift(detection);
      return detection;
    }

    const ok = await this.supabase.insertar("detecciones", detection, auth);
    if (!ok) throw new ServiceUnavailableException("No se pudo guardar la detección");
    return detection;
  }
}