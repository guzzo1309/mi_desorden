import {
  type CallHandler,
  type ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { catchError, finalize, type Observable, tap, throwError } from "rxjs";
import type { RequestConSesion } from "../shared/auth/usuario.decorator";
import { SupabaseRestService } from "../shared/supabase/supabase-rest.service";
import { ipDe } from "../utils/request";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** El inventario sale del header, del body o del query, en ese orden. */
function inventarioDe(req: RequestConSesion): string | null {
  const h = req.headers["x-inventario-id"];
  if (typeof h === "string" && UUID.test(h)) return h;
  const b = (req.body as { inventario_id?: string } | undefined)?.inventario_id;
  if (b && UUID.test(b)) return b;
  const q = req.query?.inventario_id;
  return typeof q === "string" && UUID.test(q) ? q : null;
}

/**
 * Bitácora de uso de la API. Nunca rompe el request.
 *
 * Solo registra requests con sesión: la policy de `usos_api` exige
 * `usuario_id = auth.uid()`, así que una fila con usuario null siempre rebota.
 */
@Injectable()
export class UsosInterceptor implements NestInterceptor {
  constructor(private readonly supabase: SupabaseRestService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== "http") return next.handle();

    const req = ctx.switchToHttp().getRequest<RequestConSesion>();
    if (!req.usuario) return next.handle();
    if (req.method === "OPTIONS" || req.url.startsWith("/health")) return next.handle();

    const inicio = Date.now();
    let estado = 200;

    return next.handle().pipe(
      tap(() => {
        estado = req.res?.statusCode ?? 200;
      }),
      catchError((err: unknown) => {
        estado = err instanceof HttpException ? err.getStatus() : 500;
        return throwError(() => err);
      }),
      finalize(() => {
        void this.supabase.insertar(
          "usos_api",
          {
            usuario_id: req.usuario?.id ?? null,
            inventario_id: inventarioDe(req),
            ruta: req.route?.path ?? req.url.split("?")[0],
            metodo: req.method,
            estado,
            duracion_ms: Date.now() - inicio,
            ip: ipDe(req) || null,
          },
          req.headers.authorization,
        );
      }),
    );
  }
}