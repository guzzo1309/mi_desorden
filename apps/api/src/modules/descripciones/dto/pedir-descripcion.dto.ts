import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

const recortar = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/** El owner le pide a la IA que escriba o mejore la descripción de un producto. */
export class PedirDescripcionDto {
  @ApiProperty({ description: "Inventario del producto: ahí se mira si puedes usar la IA" })
  @IsUUID()
  inventario_id: string;

  @ApiPropertyOptional({ description: "Null si el producto todavía no se guardó" })
  @IsOptional()
  @IsUUID()
  producto_id?: string | null;

  @ApiProperty({ enum: ["generar", "mejorar"] })
  @IsIn(["generar", "mejorar"])
  modo: "generar" | "mejorar";

  @ApiProperty({ example: "Coca-Cola 2 L" })
  @Transform(recortar)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({ example: "Bebidas" })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(60)
  categoria?: string | null;

  @ApiPropertyOptional({ description: "Lo que ya escribió el owner (obligatorio para mejorar)" })
  @Transform(recortar)
  @ValidateIf((o: PedirDescripcionDto) => o.modo === "mejorar" || o.borrador != null)
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  borrador?: string;

  @ApiPropertyOptional({ type: [String], description: "Categorías del inventario" })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  categorias?: string[];
}
