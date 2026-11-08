import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { UsuarioActual, type UsuarioSesion } from "../../shared/auth/usuario.decorator";
import { DescripcionesService } from "./descripciones.service";
import { PedirDescripcionDto } from "./dto/pedir-descripcion.dto";

@ApiTags("descripciones")
@Controller("descripciones")
export class DescripcionesController {
  constructor(private readonly descripciones: DescripcionesService) {}

  @Post()
  @HttpCode(200)
  @ApiBearerAuth()
  // Cada pedido gasta tokens: límite propio, más bajo que el general.
  @Throttle({ general: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: "La IA escribe o mejora la descripción de un producto (solo el owner)",
  })
  pedir(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body() dto: PedirDescripcionDto,
    @Req() req: Request,
  ) {
    const token = (req.headers.authorization ?? "").split(" ")[1] ?? "";
    return this.descripciones.pedir(usuario, token, dto);
  }
}
