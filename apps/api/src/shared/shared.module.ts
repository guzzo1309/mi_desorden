import { Global, Module } from "@nestjs/common";
import { IntentosFallidosService } from "./auth/intentos-fallidos.service";
import { SesionGuard } from "./auth/sesion.guard";
import { SupabaseJwtService } from "./auth/supabase-jwt.service";

/** Lo que usan varios módulos. Global para no importarlo en cada uno. */
@Global()
@Module({
  providers: [SupabaseJwtService, IntentosFallidosService, SesionGuard],
  exports: [SupabaseJwtService, IntentosFallidosService, SesionGuard],
})
export class SharedModule {}
