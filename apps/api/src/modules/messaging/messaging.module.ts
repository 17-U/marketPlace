import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConversationsController } from "./conversations.controller";
import { ConversationsService } from "./conversations.service";
import { ChatGateway } from "./chat.gateway";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [JwtModule.register({}), NotificationsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ChatGateway],
})
export class MessagingModule {}
