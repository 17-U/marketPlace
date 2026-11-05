import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { OrdersService } from "./orders.service";

@Injectable()
export class OrdersSchedulerService {
  private readonly logger = new Logger(OrdersSchedulerService.name);

  constructor(private readonly orders: OrdersService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleAutoRelease(): Promise<void> {
    const count = await this.orders.autoReleaseDueOrders();
    if (count > 0) {
      this.logger.log(`${count} commande(s) auto-confirmée(s) et fonds libérés`);
    }
  }
}
