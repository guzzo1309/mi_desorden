import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UsuarioActual, type UsuarioSesion } from "../../shared/auth/usuario.decorator";

@ApiTags("auth")
@ApiBearerAuth()
@Controller("auth")
export class AuthController {
  @Get("me")
  @ApiOperation({ summary: "Quién soy según el token de Supabase. Sirve para probar la sesión." })
  me(@UsuarioActual() usuario: UsuarioSesion) {
    return usuario;
  }
}
