import { Module } from "@nestjs/common";
import { DisputesController } from "./disputes.controller";
import { DisputesService } from "./disputes.service";
import { StorageModule } from "../storage/storage.module";
import { OrdersModule } from "../orders/orders.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [StorageModule, OrdersModule, NotificationsModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
