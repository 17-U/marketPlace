import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import sharp from "sharp";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { PHOTOS_QUEUE, PROCESS_PHOTO_JOB } from "./photos.constants";

interface ProcessPhotoJobData {
  photoId: string;
  baseKey: string;
}

const SIZES = [
  { suffix: "thumb", width: 400 },
  { suffix: "medium", width: 800 },
  { suffix: "large", width: 1600 },
] as const;

@Processor(PHOTOS_QUEUE)
export class PhotosProcessor extends WorkerHost {
  private readonly logger = new Logger(PhotosProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {
    super();
  }

  async process(job: Job<ProcessPhotoJobData>): Promise<void> {
    if (job.name !== PROCESS_PHOTO_JOB) return;

    const { photoId, baseKey } = job.data;

    const photo = await this.prisma.listingPhoto.findUnique({ where: { id: photoId } });
    if (!photo) {
      this.logger.warn(`Photo ${photoId} introuvable, job ignoré`);
      return;
    }

    const originalKey = this.s3.keyFromUrl(photo.originalUrl);
    const originalBuffer = await this.s3.download(originalKey);
    const metadata = await sharp(originalBuffer).metadata();

    const urls: Record<string, string> = {};

    for (const size of SIZES) {
      // .webp() sans .withMetadata(): les métadonnées EXIF/ICC de l'original ne sont pas
      // recopiées dans le fichier généré (comportement par défaut de sharp).
      const resized = await sharp(originalBuffer)
        .rotate()
        .resize({ width: size.width, withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 80 })
        .toBuffer();

      const key = `${baseKey}/${size.suffix}.webp`;
      urls[size.suffix] = await this.s3.upload(key, resized, "image/webp");
    }

    await this.prisma.listingPhoto.update({
      where: { id: photoId },
      data: {
        thumbUrl: urls.thumb,
        mediumUrl: urls.medium,
        largeUrl: urls.large,
        width: metadata.width,
        height: metadata.height,
      },
    });
  }
}
