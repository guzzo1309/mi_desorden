import { Global, Module } from "@nestjs/common";
import { SupabaseRestService } from "./supabase-rest.service";

@Global()
@Module({
  providers: [SupabaseRestService],
  exports: [SupabaseRestService],
})
export class SupabaseModule {}