import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PhotosController } from "./photos.controller";
import { PhotosService } from "./photos.service";
import { PhotosProcessor } from "./photos.processor";
import { StorageModule } from "../storage/storage.module";
import { PHOTOS_QUEUE } from "./photos.constants";

@Module({
  imports: [BullModule.registerQueue({ name: PHOTOS_QUEUE }), StorageModule],
  controllers: [PhotosController],
  providers: [PhotosService, PhotosProcessor],
})
export class PhotosModule {}
