import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { MAX_LISTING_PHOTOS, ListingPhotoDto, ListingStatus } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { PHOTOS_QUEUE, PROCESS_PHOTO_JOB } from "./photos.constants";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    @InjectQueue(PHOTOS_QUEUE) private readonly photosQueue: Queue,
  ) {}

  async upload(
    sellerId: string,
    listingId: string,
    file: Express.Multer.File,
  ): Promise<ListingPhotoDto> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException("Format d'image non supporté (jpeg, png ou webp uniquement)");
    }

    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: { _count: { select: { photos: true } } },
    });

    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("Vous n'êtes pas le propriétaire de cette annonce");
    }
    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Impossible d'ajouter une photo à une annonce vendue");
    }
    if (listing._count.photos >= MAX_LISTING_PHOTOS) {
      throw new BadRequestException(`Maximum ${MAX_LISTING_PHOTOS} photos par annonce`);
    }

    const ext = MIME_TO_EXT[file.mimetype];
    const baseKey = `listings/${listingId}/${randomUUID()}`;
    const originalUrl = await this.s3.upload(`${baseKey}/original.${ext}`, file.buffer, file.mimetype);

    const photo = await this.prisma.listingPhoto.create({
      data: {
        listingId,
        originalUrl,
        position: listing._count.photos,
      },
    });

    await this.photosQueue.add(PROCESS_PHOTO_JOB, { photoId: photo.id, baseKey });

    return this.toDto(photo.id, originalUrl, null, null, null, photo.position);
  }

  async remove(sellerId: string, listingId: string, photoId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("Vous n'êtes pas le propriétaire de cette annonce");
    }

    const photo = await this.prisma.listingPhoto.findUnique({ where: { id: photoId } });
    if (!photo || photo.listingId !== listingId) {
      throw new NotFoundException("Photo introuvable");
    }

    const urls = [photo.originalUrl, photo.thumbUrl, photo.mediumUrl, photo.largeUrl].filter(
      (url): url is string => !!url,
    );
    await Promise.allSettled(urls.map((url) => this.s3.delete(this.s3.keyFromUrl(url))));

    await this.prisma.listingPhoto.delete({ where: { id: photoId } });
  }

  private toDto(
    id: string,
    _originalUrl: string,
    thumbUrl: string | null,
    mediumUrl: string | null,
    largeUrl: string | null,
    position: number,
  ): ListingPhotoDto {
    return { id, thumbUrl, mediumUrl, largeUrl, position };
  }
}
