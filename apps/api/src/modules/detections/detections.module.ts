import { Module } from "@nestjs/common";
import { DetectionsController } from "./detections.controller";
import { DetectionsRepository } from "./detections.repository";
import { DetectionsService } from "./detections.service";

@Module({
  controllers: [DetectionsController],
  providers: [DetectionsService, DetectionsRepository],
})
export class DetectionsModule {}
