import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SellerVerification } from "@prisma/client";
import { NotificationType, SellerVerificationDto, VerificationStatus } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { NotificationsService } from "../notifications/notifications.service";

type VerificationWithUser = SellerVerification & {
  user: { firstName: string; lastName: string; phone: string };
};

const INCLUDE_USER = { user: { select: { firstName: true, lastName: true, phone: true } } };

@Injectable()
export class SellerVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly notifications: NotificationsService,
  ) {}

  async submit(
    userId: string,
    idCardFile: Express.Multer.File,
    selfieFile: Express.Multer.File,
  ): Promise<SellerVerificationDto> {
    const existing = await this.prisma.sellerVerification.findUnique({ where: { userId } });
    if (existing && existing.status !== VerificationStatus.REJECTED) {
      throw new BadRequestException("Une vérification est déjà en cours ou validée");
    }

    const idCardUrl = await this.uploadDoc(userId, "id-card", idCardFile);
    const selfieUrl = await this.uploadDoc(userId, "selfie", selfieFile);

    const verification = await this.prisma.sellerVerification.upsert({
      where: { userId },
      update: {
        idCardPhotoUrl: idCardUrl,
        selfiePhotoUrl: selfieUrl,
        status: VerificationStatus.PENDING,
        rejectionReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      create: {
        userId,
        idCardPhotoUrl: idCardUrl,
        selfiePhotoUrl: selfieUrl,
        status: VerificationStatus.PENDING,
      },
      include: INCLUDE_USER,
    });

    return this.toDto(verification);
  }

  async findMine(userId: string): Promise<SellerVerificationDto | null> {
    const verification = await this.prisma.sellerVerification.findUnique({
      where: { userId },
      include: INCLUDE_USER,
    });
    return verification ? this.toDto(verification) : null;
  }

  async findPending(): Promise<SellerVerificationDto[]> {
    const verifications = await this.prisma.sellerVerification.findMany({
      where: { status: VerificationStatus.PENDING },
      include: INCLUDE_USER,
      orderBy: { createdAt: "asc" },
    });
    return verifications.map((v) => this.toDto(v));
  }

  async approve(adminId: string, verificationId: string): Promise<SellerVerificationDto> {
    const verification = await this.getOrThrow(verificationId);

    const updated = await this.prisma.sellerVerification.update({
      where: { id: verificationId },
      data: {
        status: VerificationStatus.APPROVED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      include: INCLUDE_USER,
    });

    await this.notifications.notify({
      userId: verification.userId,
      type: NotificationType.SELLER_VERIFICATION_RESULT,
      title: "Vérification approuvée",
      body: "Votre identité a été vérifiée. Vous êtes maintenant un vendeur vérifié.",
      alsoEmail: true,
    });

    return this.toDto(updated);
  }

  async reject(adminId: string, verificationId: string, reason: string): Promise<SellerVerificationDto> {
    const verification = await this.getOrThrow(verificationId);

    const updated = await this.prisma.sellerVerification.update({
      where: { id: verificationId },
      data: {
        status: VerificationStatus.REJECTED,
        reviewedById: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
      include: INCLUDE_USER,
    });

    await this.notifications.notify({
      userId: verification.userId,
      type: NotificationType.SELLER_VERIFICATION_RESULT,
      title: "Vérification refusée",
      body: `Votre vérification a été refusée: ${reason}`,
      alsoEmail: true,
    });

    return this.toDto(updated);
  }

  private async uploadDoc(userId: string, kind: string, file: Express.Multer.File): Promise<string> {
    const ext = file.mimetype === "image/png" ? "png" : "jpg";
    const key = `verifications/${userId}/${kind}-${randomUUID()}.${ext}`;
    return this.s3.upload(key, file.buffer, file.mimetype);
  }

  private async getOrThrow(id: string): Promise<SellerVerification> {
    const verification = await this.prisma.sellerVerification.findUnique({ where: { id } });
    if (!verification) {
      throw new NotFoundException("Vérification introuvable");
    }
    return verification;
  }

  private toDto(verification: VerificationWithUser): SellerVerificationDto {
    return {
      id: verification.id,
      userId: verification.userId,
      userFirstName: verification.user.firstName,
      userLastName: verification.user.lastName,
      userPhone: verification.user.phone,
      idCardPhotoUrl: verification.idCardPhotoUrl,
      selfiePhotoUrl: verification.selfiePhotoUrl,
      status: verification.status as VerificationStatus,
      rejectionReason: verification.rejectionReason,
      reviewedAt: verification.reviewedAt?.toISOString() ?? null,
      createdAt: verification.createdAt.toISOString(),
    };
  }
}
