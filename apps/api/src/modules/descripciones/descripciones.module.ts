import { Module } from "@nestjs/common";
import { DescripcionesController } from "./descripciones.controller";
import { DescripcionesService } from "./descripciones.service";

@Module({ controllers: [DescripcionesController], providers: [DescripcionesService] })
export class DescripcionesModule {}
