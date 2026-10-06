import type { Detection, Paginado } from "@mi-desorden/core";
import { Injectable } from "@nestjs/common";
import { ahoraIso, paginar } from "../../utils";
import { DetectionsRepository } from "./detections.repository";
import type { CrearDeteccionDto } from "./dto/crear-deteccion.dto";

@Injectable()
export class DetectionsService {
  constructor(private readonly repo: DetectionsRepository) {}

  /** Cada usuario ve solo sus detecciones. */
  listar(usuarioId: string, inventarioId?: string): Paginado<Detection> {
    return paginar(this.repo.listar(usuarioId, inventarioId));
  }

  crear(usuarioId: string, dto: CrearDeteccionDto): Detection {
    return this.repo.guardar({
      id: crypto.randomUUID(),
      usuario_id: usuarioId,
      inventario_id: dto.inventario_id ?? null,
      producto_id: dto.producto_id ?? null,
      etiqueta: dto.etiqueta,
      confianza: dto.confianza,
      imagen_url: dto.imagen_url ?? null,
      creada_en: ahoraIso(),
    });
  }
}
