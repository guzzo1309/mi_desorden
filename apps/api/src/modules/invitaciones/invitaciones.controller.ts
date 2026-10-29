import { Body, Controller, Get, Header, HttpCode, Post, Query, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Publico } from "../../shared/auth/publico.decorator";
import { UsuarioActual, type UsuarioSesion } from "../../shared/auth/usuario.decorator";
import { htmlAbrir } from "./correo";
import { AvisarInvitacionDto } from "./dto/avisar-invitacion.dto";
import { InvitacionesService } from "./invitaciones.service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@ApiTags("invitaciones")
@Controller("invitaciones")
export class InvitacionesController {
  constructor(private readonly invitaciones: InvitacionesService) {}

  @Post("aviso")
  @HttpCode(200)
  @ApiBearerAuth()
  // Cada aviso es un correo: límite propio, más bajo que el general.
  @Throttle({ general: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: "Manda el correo a alguien que un owner o admin acaba de invitar" })
  avisar(
    @UsuarioActual() usuario: UsuarioSesion,
    @Body() dto: AvisarInvitacionDto,
    @Req() req: Request,
  ) {
    const token = (req.headers.authorization ?? "").split(" ")[1] ?? "";
    return this.invitaciones.avisar(usuario, token, dto.email, dto.inventarios);
  }

  @Get("abrir")
  @Publico()
  @Header("Content-Type", "text/html; charset=utf-8")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Página del botón del correo: abre la app en el inventario" })
  abrir(@Query("inv") inv?: string, @Query("registro") registro?: string) {
    if (registro === "1") return htmlAbrir("midesorden://registro");
    return htmlAbrir(inv && UUID.test(inv) ? `midesorden://abrir?inv=${inv}` : "midesorden://");
  }
}
