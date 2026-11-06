import { Body, Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { UsuarioActual, type UsuarioSesion } from "../../shared/auth/usuario.decorator";
import { CrearEmpleadoDto } from "./dto/crear-empleado.dto";
import { EmpleadosService } from "./empleados.service";

@ApiTags("empleados")
@Controller("empleados")
export class EmpleadosController {
  constructor(private readonly empleados: EmpleadosService) {}

  @Post()
  @HttpCode(200)
  @ApiBearerAuth()
  // Cada llamada puede crear una cuenta: límite propio, más bajo que el general.
  @Throttle({ general: { ttl: 60_000, limit: 10 } })
  @ApiOperation({
    summary: "El owner crea la cuenta de un empleado con una contraseña temporal",
  })
  crear(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body() dto: CrearEmpleadoDto,
    @Req() req: Request,
  ) {
    const token = (req.headers.authorization ?? "").split(" ")[1] ?? "";
    return this.empleados.crear(usuario, token, dto);
  }
}
