import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

/** El owner crea la cuenta de un empleado con una contraseña temporal. */
export class CrearEmpleadoDto {
  @ApiProperty({ example: "ana@ejemplo.com" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: "Ana Pérez" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  nombre: string;

  @ApiProperty({ description: "Contraseña temporal: en el primer ingreso tiene que cambiarla" })
  @IsString()
  @MinLength(8)
  // bcrypt solo mira los primeros 72 bytes.
  @MaxLength(72)
  clave: string;

  @ApiProperty({ enum: ["editor", "lector"] })
  @IsIn(["editor", "lector"])
  rol: "editor" | "lector";

  @ApiProperty({ type: [String], description: "Inventarios a los que se lo agrega" })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID("all", { each: true })
  inventarios: string[];
}
