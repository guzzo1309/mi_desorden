import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class ListarDeteccionesQuery {
  @ApiPropertyOptional({ description: "Solo las de este inventario" })
  @IsOptional()
  @IsUUID()
  inventario_id?: string;
}
