import type { INestApplication } from "@nestjs/common";
import { HttpExceptionFilter } from "../shared/filters/http-exception.filter";

/** Todas las respuestas de error con la misma forma. */
export function aplicarFiltros(app: INestApplication) {
  app.useGlobalFilters(new HttpExceptionFilter());
}
