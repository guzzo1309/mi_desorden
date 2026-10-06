import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Publico } from "../../shared/auth/publico.decorator";
import { ahoraIso } from "../../utils";

@ApiTags("health")
@Publico()
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return { ok: true, ts: ahoraIso() };
  }
}
