import { Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { NotificationDto } from "@marketplace/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { NotificationsService } from "./notifications.service";

@Controller("me/notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<NotificationDto[]> {
    return this.notifications.findMine(user.id);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.notifications.markRead(user.id, id);
  }

  @Post("read-all")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.notifications.markAllRead(user.id);
  }
}
