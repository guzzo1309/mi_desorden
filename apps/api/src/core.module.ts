import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { DetectionsModule } from "./modules/detections/detections.module";
import { HealthModule } from "./modules/health/health.module";
import { SesionGuard } from "./shared/auth/sesion.guard";
import { validarEnv } from "./shared/config/env";
import { SharedModule } from "./shared/shared.module";

@Module({
  imports: [
    // Las variables vienen de Doppler (`doppler run --`); no se lee ningún .env.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validarEnv }),
    // Límite general por IP.
    ThrottlerModule.forRoot({ throttlers: [{ name: "general", ttl: 60_000, limit: 120 }] }),
    SharedModule,
    HealthModule,
    AuthModule,
    DetectionsModule,
  ],
  providers: [
    // El orden importa: primero el rate limit, después la sesión.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SesionGuard },
  ],
})
export class CoreModule {}
