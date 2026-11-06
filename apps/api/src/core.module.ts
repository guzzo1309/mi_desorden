import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./modules/auth/auth.module";
import { DetectionsModule } from "./modules/detections/detections.module";
import { EmpleadosModule } from "./modules/empleados/empleados.module";
import { HealthModule } from "./modules/health/health.module";
import { InvitacionesModule } from "./modules/invitaciones/invitaciones.module";
import { SesionGuard } from "./shared/auth/sesion.guard";
import { validarEnv } from "./shared/config/env";
import { SharedModule } from "./shared/shared.module";
import { SupabaseModule } from "./shared/supabase/supabase.module";
import { UsosInterceptor } from "./usage/interceptor";

@Module({
  imports: [
    // Las variables vienen de Doppler (`doppler run --`); no se lee ningún .env.
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: validarEnv }),
    // Límite general por IP.
    ThrottlerModule.forRoot({ throttlers: [{ name: "general", ttl: 60_000, limit: 120 }] }),
    SharedModule,
    SupabaseModule,
    HealthModule,
    AuthModule,
    DetectionsModule,
    InvitacionesModule,
    EmpleadosModule,
  ],
  providers: [
    // El orden importa: primero el rate limit, después la sesión.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: SesionGuard },
    // Último: solo mira requests que ya pasaron el guard, así tiene usuario.
    { provide: APP_INTERCEPTOR, useClass: UsosInterceptor },
  ],
})
export class CoreModule {}