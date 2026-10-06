import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../config/env";

type Registro = { fallos: number; desde: number; bloqueadoHasta: number };

/**
 * Cuenta tokens inválidos por IP. Pasado el máximo dentro de la ventana, la IP
 * queda bloqueada un rato. En memoria: alcanza para una sola instancia; con
 * varias, mover a Redis.
 */
@Injectable()
export class IntentosFallidosService {
  private readonly registros = new Map<string, Registro>();
  private readonly maxFallos: number;
  private readonly ventanaMs: number;

  constructor(config: ConfigService<Env, true>) {
    this.maxFallos = config.get("AUTH_MAX_FALLOS", { infer: true });
    this.ventanaMs = config.get("AUTH_BLOQUEO_MIN", { infer: true }) * 60_000;
  }

  /** Segundos que le faltan al bloqueo, o 0 si la IP puede seguir. */
  bloqueo(ip: string, ahora = Date.now()): number {
    const r = this.registros.get(ip);
    if (!r) return 0;
    if (r.bloqueadoHasta > ahora) return Math.ceil((r.bloqueadoHasta - ahora) / 1000);
    if (ahora - r.desde > this.ventanaMs) this.registros.delete(ip);
    return 0;
  }

  registrarFallo(ip: string, ahora = Date.now()) {
    this.limpiar(ahora);
    const r = this.registros.get(ip);
    const vigente =
      r && ahora - r.desde <= this.ventanaMs ? r : { fallos: 0, desde: ahora, bloqueadoHasta: 0 };
    vigente.fallos += 1;
    if (vigente.fallos >= this.maxFallos) vigente.bloqueadoHasta = ahora + this.ventanaMs;
    this.registros.set(ip, vigente);
  }

  /** Que el mapa no crezca sin límite con IPs que no vuelven. */
  private limpiar(ahora: number) {
    if (this.registros.size < 10_000) return;
    for (const [ip, r] of this.registros) {
      if (r.bloqueadoHasta < ahora && ahora - r.desde > this.ventanaMs) this.registros.delete(ip);
    }
  }
}
