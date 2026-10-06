import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { configurarApp, PREFIJO } from "./app.setup";
import { CoreModule } from "./core.module";

/** Servidor local (bun dev). En Vercel se usa serverless.ts. */
async function bootstrap() {
  const app = configurarApp(await NestFactory.create(CoreModule));
  const port = app.get(ConfigService).get<number>("PORT", 3000);
  await app.listen(port);
  console.log(`API en http://localhost:${port}/${PREFIJO} — docs en /${PREFIJO}/docs`);
}

bootstrap();
