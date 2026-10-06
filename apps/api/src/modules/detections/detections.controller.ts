import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsuarioActual, type UsuarioSesion } from "../../shared/auth/usuario.decorator";
import { DetectionsService } from "./detections.service";
import { CrearDeteccionDto } from "./dto/crear-deteccion.dto";
import { ListarDeteccionesQuery } from "./dto/listar-detecciones.query";

/** Lo que reconoce la cámara del teléfono. Requiere sesión (guard global). */
@ApiTags("detections")
@ApiBearerAuth()
@Controller("detections")
export class DetectionsController {
  constructor(private readonly detections: DetectionsService) {}

  @Get()
  @ApiOperation({ summary: "Mis detecciones" })
  listar(@UsuarioActual() usuario: UsuarioSesion, @Query() query: ListarDeteccionesQuery) {
    return this.detections.listar(usuario.id, query.inventario_id);
  }

  @Post()
  @ApiOperation({ summary: "La app registra algo que reconoció la cámara" })
  crear(@UsuarioActual() usuario: UsuarioSesion, @Body() dto: CrearDeteccionDto) {
    return this.detections.crear(usuario.id, dto);
  }
}
