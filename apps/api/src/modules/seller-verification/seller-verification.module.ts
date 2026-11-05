import { Module } from "@nestjs/common";
import { SellerVerificationController } from "./seller-verification.controller";
import { SellerVerificationService } from "./seller-verification.service";
import { StorageModule } from "../storage/storage.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [StorageModule, NotificationsModule],
  controllers: [SellerVerificationController],
  providers: [SellerVerificationService],
  exports: [SellerVerificationService],
})
export class SellerVerificationModule {}
