import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { errors } from "jose";
import { IntentosFallidosService } from "./intentos-fallidos.service";
import { ES_PUBLICO } from "./publico.decorator";
import { SupabaseJwtService } from "./supabase-jwt.service";
import type { RequestConSesion } from "./usuario.decorator";
import { ipDe } from "../../utils/request";

/**
 * Guard global: toda ruta pide `Authorization: Bearer <access token de Supabase>`
 * salvo las marcadas con @Publico(). Los tokens inválidos cuentan como intento
 * fallido por IP; pasado el límite, la IP recibe 429 hasta que vence el bloqueo.
 */
@Injectable()
export class SesionGuard implements CanActivate {
  private readonly logger = new Logger(SesionGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: SupabaseJwtService,
    private readonly intentos: IntentosFallidosService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(ES_PUBLICO, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (publico) return true;

    const req = ctx.switchToHttp().getRequest<RequestConSesion>();
    const ip = ipDe(req);

    const espera = this.intentos.bloqueo(ip);
    if (espera > 0) {
      ctx.switchToHttp().getResponse<Response>().setHeader("Retry-After", String(espera));
      throw new HttpException(
        "Demasiados intentos con sesión inválida. Prueba más tarde.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const [tipo, token] = (req.headers.authorization ?? "").split(" ");
    if (tipo !== "Bearer" || !token) {
      throw new UnauthorizedException("Falta el token de sesión");
    }

    try {
      req.usuario = await this.jwt.verificar(token);
      return true;
    } catch (e) {
      // Si no pudimos bajar las claves de Supabase, la culpa no es del cliente.
      if (e instanceof errors.JWKSTimeout || (e instanceof TypeError && /fetch/i.test(e.message))) {
        this.logger.error(`No se pudieron obtener las claves de Supabase: ${e.message}`);
        throw new ServiceUnavailableException("No se pudo verificar la sesión. Prueba de nuevo.");
      }
      this.intentos.registrarFallo(ip);
      this.logger.warn(`Token rechazado desde ${ip}: ${(e as Error).message}`);
      // Mensaje genérico a propósito: no le decimos al cliente qué parte falló.
      throw new UnauthorizedException("Sesión inválida o vencida");
    }
  }
}
