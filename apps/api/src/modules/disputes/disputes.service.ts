import { randomUUID } from "node:crypto";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Dispute, DisputeMessage } from "@prisma/client";
import { DisputeDto, DisputeMessageDto, DisputeStatus, NotificationType } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { S3Service } from "../storage/s3.service";
import { OrdersService } from "../orders/orders.service";
import { NotificationsService } from "../notifications/notifications.service";
import { OpenDisputeDto } from "./dto/open-dispute.dto";

type DisputeWithMessages = Dispute & { messages: DisputeMessage[] };

@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly orders: OrdersService,
    private readonly notifications: NotificationsService,
  ) {}

  async open(buyerId: string, orderId: string, dto: OpenDisputeDto): Promise<DisputeDto> {
    const existing = await this.prisma.dispute.findUnique({ where: { orderId } });
    if (existing) {
      throw new BadRequestException("Un litige existe déjà pour cette commande");
    }

    // Réutilise la machine à états des commandes (Phase 4): vérifie la
    // propriété (acheteur) et la validité de la transition PAID_HELD/SHIPPED/
    // DELIVERED -> DISPUTED, journalisée côté Order.
    const order = await this.orders.markDisputed(buyerId, orderId, dto.reason);

    const dispute = await this.prisma.dispute.create({
      data: {
        orderId,
        openedById: buyerId,
        reason: dto.reason,
        description: dto.description,
        photoUrls: [],
        status: DisputeStatus.OPEN,
      },
      include: { messages: true },
    });

    await this.notifyDisputeOpened(order.seller.id, dto.reason);

    return this.toDto(dispute);
  }

  private async notifyDisputeOpened(sellerId: string, reason: string): Promise<void> {
    const admins = await this.prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    const recipients = [sellerId, ...admins.map((a) => a.id)];

    for (const userId of recipients) {
      await this.notifications.notify({
        userId,
        type: NotificationType.DISPUTE_OPENED,
        title: "Litige ouvert",
        body: `Un litige a été ouvert: ${reason}`,
        alsoEmail: true,
      });
    }
  }

  async addMessage(userId: string, disputeId: string, content: string, isAdmin: boolean): Promise<DisputeMessageDto> {
    const dispute = await this.getAccessibleOrThrow(userId, disputeId, isAdmin);

    const message = await this.prisma.disputeMessage.create({
      data: { disputeId, senderId: userId, content, photoUrls: [] },
    });

    if (isAdmin && dispute.status === DisputeStatus.OPEN) {
      await this.prisma.dispute.update({
        where: { id: disputeId },
        data: { status: DisputeStatus.UNDER_REVIEW },
      });
    }

    return this.toMessageDto(message);
  }

  async addPhoto(userId: string, disputeId: string, isAdmin: boolean, file: Express.Multer.File): Promise<string> {
    await this.getAccessibleOrThrow(userId, disputeId, isAdmin);

    const ext = file.mimetype === "image/png" ? "png" : "jpg";
    const key = `disputes/${disputeId}/${randomUUID()}.${ext}`;
    const url = await this.s3.upload(key, file.buffer, file.mimetype);

    await this.prisma.dispute.update({
      where: { id: disputeId },
      data: { photoUrls: { push: url } },
    });

    return url;
  }

  async resolve(
    adminId: string,
    disputeId: string,
    outcome: "RELEASE" | "REFUND",
    resolutionNote: string | undefined,
  ): Promise<DisputeDto> {
    const dispute = await this.prisma.dispute.findUnique({ where: { id: disputeId }, include: { messages: true } });
    if (!dispute) {
      throw new NotFoundException("Litige introuvable");
    }
    if (dispute.status !== DisputeStatus.OPEN && dispute.status !== DisputeStatus.UNDER_REVIEW) {
      throw new BadRequestException("Ce litige a déjà été résolu");
    }

    const order = await this.orders.resolveDispute(adminId, dispute.orderId, outcome);

    for (const userId of [order.buyer.id, order.seller.id]) {
      await this.notifications.notify({
        userId,
        type: NotificationType.DISPUTE_RESOLVED,
        title: "Litige résolu",
        body:
          outcome === "RELEASE"
            ? "Le litige a été résolu: les fonds ont été libérés au vendeur."
            : "Le litige a été résolu: l'acheteur a été remboursé.",
        alsoEmail: true,
      });
    }

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: outcome === "RELEASE" ? DisputeStatus.RESOLVED_RELEASE : DisputeStatus.RESOLVED_REFUND,
        resolvedById: adminId,
        resolutionNote,
        resolvedAt: new Date(),
      },
      include: { messages: true },
    });

    return this.toDto(updated);
  }

  async findMine(userId: string): Promise<DisputeDto[]> {
    const disputes = await this.prisma.dispute.findMany({
      where: { order: { OR: [{ buyerId: userId }, { sellerId: userId }] } },
      include: { messages: true },
      orderBy: { createdAt: "desc" },
    });
    return disputes.map((d) => this.toDto(d));
  }

  async findAllForAdmin(): Promise<DisputeDto[]> {
    const disputes = await this.prisma.dispute.findMany({
      include: { messages: true },
      orderBy: { createdAt: "desc" },
    });
    return disputes.map((d) => this.toDto(d));
  }

  async getDetail(userId: string, disputeId: string, isAdmin: boolean): Promise<DisputeDto> {
    const dispute = await this.getAccessibleOrThrow(userId, disputeId, isAdmin);
    return this.toDto(dispute);
  }

  private async getAccessibleOrThrow(
    userId: string,
    disputeId: string,
    isAdmin: boolean,
  ): Promise<DisputeWithMessages> {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { messages: { orderBy: { createdAt: "asc" } }, order: true },
    });
    if (!dispute) {
      throw new NotFoundException("Litige introuvable");
    }
    if (!isAdmin && dispute.order.buyerId !== userId && dispute.order.sellerId !== userId) {
      throw new ForbiddenException("Vous ne faites pas partie de ce litige");
    }
    return dispute;
  }

  private toDto(dispute: DisputeWithMessages): DisputeDto {
    return {
      id: dispute.id,
      orderId: dispute.orderId,
      openedById: dispute.openedById,
      reason: dispute.reason,
      description: dispute.description,
      photoUrls: dispute.photoUrls,
      status: dispute.status as DisputeStatus,
      resolvedById: dispute.resolvedById,
      resolutionNote: dispute.resolutionNote,
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
      createdAt: dispute.createdAt.toISOString(),
      messages: dispute.messages.map((m) => this.toMessageDto(m)),
    };
  }

  private toMessageDto(message: DisputeMessage): DisputeMessageDto {
    return {
      id: message.id,
      senderId: message.senderId,
      content: message.content,
      photoUrls: message.photoUrls,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
