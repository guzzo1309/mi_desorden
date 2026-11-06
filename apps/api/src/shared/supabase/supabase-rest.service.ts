import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface UsoApiInput {
  usuario_id: string | null;
  inventario_id: string | null;
  ruta: string;
  metodo: string;
  estado: number;
  duracion_ms: number;
  ip: string | null;
}

/**
 * Cliente REST mínimo contra Supabase. Sin SDK: el repo ya verifica JWTs con
 * jose y fetch a mano, así que acá va igual.
 *
 * Usa la anon key y el JWT del usuario que llama, así decide RLS. Sin clave o
 * sin Authorization no hace nada: por eso los tests corren offline.
 */
@Injectable()
export class SupabaseRestService {
  private readonly logger = new Logger(SupabaseRestService.name);
  private readonly url: string;
  private readonly anonKey: string;

  constructor(config: ConfigService) {
    this.url = config.get<string>("SUPABASE_URL") ?? "";
    this.anonKey = config.get<string>("SUPABASE_ANON_KEY") ?? "";
  }

  /** Público: los repositorios deciden si usan Supabase o el fallback en memoria. */
  get estaConfigurado(): boolean {
    return Boolean(this.url && this.anonKey);
  }

  private cabeceras(authorization?: string): Record<string, string> {
    return {
      apikey: this.anonKey,
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    };
  }

  /** Devuelve true si escribió. Nunca tira. */
  async insertar(tabla: string, fila: unknown, authorization?: string): Promise<boolean> {
    if (!this.estaConfigurado || !authorization) return false;
    try {
      const r = await fetch(`${this.url}/rest/v1/${tabla}`, {
        method: "POST",
        headers: { ...this.cabeceras(authorization), Prefer: "return=minimal" },
        body: JSON.stringify(fila),
      });
      if (!r.ok) {
        this.logger.warn(`${tabla}: ${r.status} ${await r.text()}`);
        return false;
      }
      return true;
    } catch (e) {
      this.logger.warn(`No se pudo escribir en ${tabla}: ${(e as Error).message}`);
      return false;
    }
  }

  /** Query cruda de PostgREST, sin `?`. Devuelve [] si falla. */
  async seleccionar<T>(tabla: string, query: string, authorization?: string): Promise<T[]> {
    if (!this.estaConfigurado || !authorization) return [];
    try {
      const r = await fetch(`${this.url}/rest/v1/${tabla}?${query}`, {
        headers: this.cabeceras(authorization),
      });
      if (!r.ok) {
        this.logger.warn(`${tabla}: ${r.status} ${await r.text()}`);
        return [];
      }
      return (await r.json()) as T[];
    } catch (e) {
      this.logger.warn(`No se pudo leer de ${tabla}: ${(e as Error).message}`);
      return [];
    }
  }
}