import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ListingPhotoDto } from "@marketplace/shared";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../auth/types/jwt-payload.type";
import { PhotosService } from "./photos.service";

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

@Controller("listings/:id/photos")
export class PhotosController {
  constructor(private readonly photos: PhotosService) {}

  @Post()
  @UseInterceptors(FileInterceptor("photo", { limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") listingId: string,
    @UploadedFile(new ParseFilePipe({ fileIsRequired: true }))
    file: Express.Multer.File,
  ): Promise<ListingPhotoDto> {
    return this.photos.upload(user.id, listingId, file);
  }

  @Delete(":photoId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") listingId: string,
    @Param("photoId") photoId: string,
  ): Promise<void> {
    await this.photos.remove(user.id, listingId, photoId);
  }
}
