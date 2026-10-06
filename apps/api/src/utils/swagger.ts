import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

/** Swagger en `/<prefijo>/docs`. Quien llama decide si se monta (no en producción salvo ENABLE_SWAGGER). */
export function crearSwagger(app: INestApplication, prefijo: string) {
  const doc = new DocumentBuilder()
    .setTitle("mi_desorden API")
    .setDescription(
      "API de mi_desorden. Todas las rutas (salvo health) piden el access token de Supabase.",
    )
    .setVersion("0.2.0")
    .addBearerAuth({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "access_token de Supabase",
    })
    .build();
  SwaggerModule.setup(`${prefijo}/docs`, app, () => SwaggerModule.createDocument(app, doc), {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  });
}
