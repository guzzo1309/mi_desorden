import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ahoraIso } from "../../utils/fecha";

export type ErrorResponse = {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path: string;
};

/** Todas las respuestas de error con la misma forma. Los 5xx se loguean con stack. */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const cuerpo = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof cuerpo === "string"
        ? cuerpo
        : ((cuerpo as { message?: string | string[] } | null)?.message ?? "Error interno");

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      statusCode: status,
      error: HttpStatus[status] ?? "Error",
      message,
      timestamp: ahoraIso(),
      path: req.url,
    };
    res.status(status).json(body);
  }
}
