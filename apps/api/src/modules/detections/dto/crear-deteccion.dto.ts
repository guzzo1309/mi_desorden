import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

/** Lo que manda la app cuando la cámara del teléfono reconoce algo. */
export class CrearDeteccionDto {
  @ApiPropertyOptional({ description: "Inventario que se estaba mirando", nullable: true })
  @IsOptional()
  @IsUUID()
  inventario_id?: string | null;

  @ApiPropertyOptional({
    description: "Producto reconocido, si es uno del inventario",
    nullable: true,
  })
  @IsOptional()
  @IsUUID()
  producto_id?: string | null;

  @ApiProperty({ example: "caja" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  etiqueta: string;

  @ApiProperty({ example: 0.91, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confianza: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUrl()
  imagen_url?: string | null;
}
