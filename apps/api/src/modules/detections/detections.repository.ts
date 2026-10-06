import type { Detection } from "@mi-desorden/core";
import { Injectable } from "@nestjs/common";

/**
 * Store en memoria: se pierde al reiniciar. Es el único lugar que hay que
 * cambiar para persistir en Supabase. Lo más nuevo primero.
 */
@Injectable()
export class DetectionsRepository {
  private readonly detections: Detection[] = [];

  listar(usuarioId: string, inventarioId?: string): Detection[] {
    return this.detections.filter(
      (d) => d.usuario_id === usuarioId && (!inventarioId || d.inventario_id === inventarioId),
    );
  }

  guardar(detection: Detection): Detection {
    this.detections.unshift(detection);
    return detection;
  }
}
