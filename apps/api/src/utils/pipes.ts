import { type INestApplication, ValidationPipe } from "@nestjs/common";

/** Validación global con los DTOs: transforma tipos y descarta propiedades que no están declaradas. */
export function aplicarPipes(app: INestApplication) {
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
}
