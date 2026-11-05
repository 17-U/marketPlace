import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { NotificationsProcessor } from "./notifications.processor";
import { EMAIL_CHANNEL } from "./channels/email-channel.interface";
import { ConsoleEmailChannel } from "./channels/console-email.channel";
import { NOTIFICATIONS_QUEUE } from "./notifications.constants";

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    { provide: EMAIL_CHANNEL, useClass: ConsoleEmailChannel },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
