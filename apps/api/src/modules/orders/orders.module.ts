import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { OrdersSchedulerService } from "./orders-scheduler.service";
import { PaymentsModule } from "../payments/payments.module";
import { SettingsModule } from "../settings/settings.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [PaymentsModule, SettingsModule, NotificationsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersSchedulerService],
  exports: [OrdersService],
})
export class OrdersModule {}
