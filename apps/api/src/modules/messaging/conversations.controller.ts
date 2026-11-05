import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ConversationDetailDto, ConversationSummaryDto } from "@marketplace/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { ConversationsService } from "./conversations.service";
import { StartConversationDto } from "./dto/start-conversation.dto";

@Controller("conversations")
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: StartConversationDto,
  ): Promise<ConversationDetailDto> {
    return this.conversations.startOrGet(user.id, dto.listingId);
  }

  @Get()
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<ConversationSummaryDto[]> {
    return this.conversations.listMine(user.id);
  }

  @Get(":id")
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<ConversationDetailDto> {
    return this.conversations.getDetail(user.id, id);
  }

  @Post(":id/read")
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string): Promise<void> {
    await this.conversations.markRead(user.id, id);
  }
}
