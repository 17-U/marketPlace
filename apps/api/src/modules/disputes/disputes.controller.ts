import {
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DisputeDto, DisputeMessageDto, Role } from "@marketplace/shared";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { DisputesService } from "./disputes.service";
import { OpenDisputeDto } from "./dto/open-dispute.dto";
import { AddDisputeMessageDto } from "./dto/add-dispute-message.dto";
import { ResolveDisputeDto } from "./dto/resolve-dispute.dto";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

@Controller()
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post("orders/:id/dispute")
  open(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") orderId: string,
    @Body() dto: OpenDisputeDto,
  ): Promise<DisputeDto> {
    return this.disputes.open(user.id, orderId, dto);
  }

  @Get("me/disputes")
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<DisputeDto[]> {
    return this.disputes.findMine(user.id);
  }

  @Roles(Role.ADMIN)
  @Get("admin/disputes")
  findAllForAdmin(): Promise<DisputeDto[]> {
    return this.disputes.findAllForAdmin();
  }

  @Get("disputes/:id")
  getDetail(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<DisputeDto> {
    return this.disputes.getDetail(user.id, id, user.role === Role.ADMIN);
  }

  @Post("disputes/:id/messages")
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AddDisputeMessageDto,
  ): Promise<DisputeMessageDto> {
    return this.disputes.addMessage(user.id, id, dto.content, user.role === Role.ADMIN);
  }

  @Post("disputes/:id/photos")
  @UseInterceptors(FileInterceptor("photo", { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  async addPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const url = await this.disputes.addPhoto(user.id, id, user.role === Role.ADMIN, file);
    return { url };
  }

  @Roles(Role.ADMIN)
  @Post("disputes/:id/resolve")
  resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: ResolveDisputeDto,
  ): Promise<DisputeDto> {
    return this.disputes.resolve(user.id, id, dto.outcome, dto.resolutionNote);
  }
}
