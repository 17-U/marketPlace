import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { Role, SellerVerificationDto } from "@marketplace/shared";
import { Roles } from "../../common/decorators/roles.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { SellerVerificationService } from "./seller-verification.service";
import { RejectVerificationDto } from "./dto/reject-verification.dto";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

@Controller()
export class SellerVerificationController {
  constructor(private readonly verifications: SellerVerificationService) {}

  @Post("me/seller-verification")
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "idCard", maxCount: 1 },
        { name: "selfie", maxCount: 1 },
      ],
      { limits: { fileSize: MAX_FILE_SIZE_BYTES } },
    ),
  )
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: { idCard?: Express.Multer.File[]; selfie?: Express.Multer.File[] },
  ): Promise<SellerVerificationDto> {
    const idCard = files.idCard?.[0];
    const selfie = files.selfie?.[0];
    if (!idCard || !selfie) {
      throw new BadRequestException("Photo de la CNI et selfie requis");
    }
    return this.verifications.submit(user.id, idCard, selfie);
  }

  @Get("me/seller-verification")
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<SellerVerificationDto | null> {
    return this.verifications.findMine(user.id);
  }

  @Roles(Role.ADMIN)
  @Get("admin/seller-verifications")
  findPending(): Promise<SellerVerificationDto[]> {
    return this.verifications.findPending();
  }

  @Roles(Role.ADMIN)
  @Post("admin/seller-verifications/:id/approve")
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
  ): Promise<SellerVerificationDto> {
    return this.verifications.approve(user.id, id);
  }

  @Roles(Role.ADMIN)
  @Post("admin/seller-verifications/:id/reject")
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: RejectVerificationDto,
  ): Promise<SellerVerificationDto> {
    return this.verifications.reject(user.id, id, dto.reason);
  }
}
