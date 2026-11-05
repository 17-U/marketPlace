import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Order, Prisma } from "@prisma/client";
import {
  canTransitionOrder,
  DELIVERY_FEES_XAF,
  DeliveryMethod,
  LedgerEntryType,
  ListingStatus,
  NotificationType,
  OrderDetailDto,
  OrderStatus,
  OrderSummaryDto,
  PaymentProviderName,
  PaymentStatus,
} from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformSettingsService } from "../settings/platform-settings.service";
import { PAYMENT_PROVIDER, PaymentProvider, WebhookEventPayload } from "../payments/payment-provider.interface";
import { NotificationsService } from "../notifications/notifications.service";
import { formatXaf } from "../../common/utils/format-xaf";
import { CreateOrderDto } from "./dto/create-order.dto";

type TxClient = Prisma.TransactionClient;

type OrderWithRelations = Order & {
  listing: { title: string; photos: { thumbUrl: string | null }[] };
  buyer: { id: string; firstName: string; lastName: string };
  seller: { id: string; firstName: string; lastName: string };
};

const ORDER_INCLUDE = {
  listing: { select: { title: true, photos: { orderBy: { position: "asc" as const }, take: 1 } } },
  buyer: { select: { id: true, firstName: true, lastName: true } },
  seller: { select: { id: true, firstName: true, lastName: true } },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: PlatformSettingsService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER) private readonly paymentProvider: PaymentProvider,
  ) {}

  async create(buyerId: string, dto: CreateOrderDto): Promise<OrderDetailDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: dto.listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.status !== ListingStatus.PUBLISHED) {
      throw new BadRequestException("Cette annonce n'est plus disponible à l'achat");
    }
    if (listing.sellerId === buyerId) {
      throw new BadRequestException("Vous ne pouvez pas acheter votre propre annonce");
    }

    const buyer = await this.prisma.user.findUnique({ where: { id: buyerId } });
    if (!buyer) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    const commissionPercent = await this.settings.getCommissionPercent();
    const commissionXaf = Math.round((listing.priceXaf * commissionPercent) / 100);
    const deliveryFeeXaf = DELIVERY_FEES_XAF[dto.deliveryMethod as DeliveryMethod];
    const totalXaf = listing.priceXaf + deliveryFeeXaf;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId,
          sellerId: listing.sellerId,
          priceXaf: listing.priceXaf,
          deliveryFeeXaf,
          commissionXaf,
          totalXaf,
          deliveryMethod: dto.deliveryMethod,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          deliveryAddressText: dto.deliveryAddressText,
          status: OrderStatus.CREATED,
        },
        include: ORDER_INCLUDE,
      });

      await tx.listing.update({
        where: { id: listing.id },
        data: { status: ListingStatus.RESERVED },
      });

      return created;
    });

    const { providerRef } = await this.paymentProvider.initiatePayment({
      orderId: order.id,
      amountXaf: totalXaf,
      payerPhone: buyer.phone,
    });

    await this.prisma.payment.create({
      data: {
        orderId: order.id,
        provider: PaymentProviderName.MOCK,
        providerRef,
        amountXaf: totalXaf,
        status: PaymentStatus.PENDING,
        idempotencyKey: order.id,
      },
    });

    return this.toDetailDto(order as OrderWithRelations, []);
  }

  async handleWebhook(rawBody: string, signatureHeader: string | undefined): Promise<void> {
    if (!this.paymentProvider.verifyWebhookSignature(rawBody, signatureHeader)) {
      throw new BadRequestException("Signature de webhook invalide");
    }

    const payload = this.paymentProvider.parseWebhookPayload(rawBody);

    const existingEvent = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: PaymentProviderName.MOCK, eventId: payload.providerRef } },
    });
    if (existingEvent?.processedAt) {
      return; // déjà traité: idempotent, on ne rejoue rien.
    }

    await this.prisma.webhookEvent.upsert({
      where: { provider_eventId: { provider: PaymentProviderName.MOCK, eventId: payload.providerRef } },
      update: {},
      create: {
        provider: PaymentProviderName.MOCK,
        eventId: payload.providerRef,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });

    await this.processWebhookPayload(payload);

    await this.prisma.webhookEvent.update({
      where: { provider_eventId: { provider: PaymentProviderName.MOCK, eventId: payload.providerRef } },
      data: { processedAt: new Date() },
    });
  }

  private async processWebhookPayload(payload: WebhookEventPayload): Promise<void> {
    const payment = await this.prisma.payment.findUnique({ where: { providerRef: payload.providerRef } });
    if (!payment) {
      throw new NotFoundException("Paiement introuvable pour cette référence");
    }

    const order = await this.prisma.order.findUnique({ where: { id: payment.orderId } });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }

    // Le montant n'est jamais repris tel quel du webhook: on le recalcule/compare
    // toujours côté serveur par rapport à ce qui a été facturé.
    if (payload.amountXaf !== order.totalXaf) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, rawPayload: payload as unknown as Prisma.InputJsonValue },
      });
      throw new BadRequestException("Montant du webhook incohérent avec la commande");
    }

    if (payload.status === "SUCCEEDED") {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCEEDED, rawPayload: payload as unknown as Prisma.InputJsonValue },
      });
      await this.transition(order.id, null, OrderStatus.PAID_HELD);
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED, rawPayload: payload as unknown as Prisma.InputJsonValue },
      });
      await this.transition(order.id, null, OrderStatus.CANCELLED, "Paiement échoué");
    }
  }

  async ship(sellerId: string, orderId: string, trackingNumber: string | undefined): Promise<OrderDetailDto> {
    const order = await this.getOrThrow(orderId);
    if (order.sellerId !== sellerId) {
      throw new ForbiddenException("Vous n'êtes pas le vendeur de cette commande");
    }
    if (order.deliveryMethod !== DeliveryMethod.HAND_DELIVERY && !trackingNumber) {
      throw new BadRequestException("Un numéro de suivi est requis pour ce mode de livraison");
    }

    await this.transition(orderId, sellerId, OrderStatus.SHIPPED, undefined, { trackingNumber });
    return this.findById(sellerId, orderId);
  }

  async confirmDelivery(buyerId: string, orderId: string): Promise<OrderDetailDto> {
    const order = await this.getOrThrow(orderId);
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("Vous n'êtes pas l'acheteur de cette commande");
    }
    if (order.status !== OrderStatus.SHIPPED) {
      throw new BadRequestException("Cette commande n'est pas en cours de livraison");
    }

    await this.confirmAndRelease(orderId, buyerId);
    return this.findById(buyerId, orderId);
  }

  async cancel(userId: string, orderId: string): Promise<OrderDetailDto> {
    const order = await this.getOrThrow(orderId);
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("Vous ne faites pas partie de cette commande");
    }
    if (order.status !== OrderStatus.CREATED) {
      throw new BadRequestException("Seule une commande non payée peut être annulée");
    }

    await this.transition(orderId, userId, OrderStatus.CANCELLED, "Annulée avant paiement");
    return this.findById(userId, orderId);
  }

  async markDisputed(buyerId: string, orderId: string, reason: string): Promise<OrderDetailDto> {
    const order = await this.getOrThrow(orderId);
    if (order.buyerId !== buyerId) {
      throw new ForbiddenException("Seul l'acheteur peut ouvrir un litige");
    }

    await this.transition(orderId, buyerId, OrderStatus.DISPUTED, reason);
    return this.findById(buyerId, orderId);
  }

  async resolveDispute(
    adminId: string,
    orderId: string,
    outcome: "RELEASE" | "REFUND",
  ): Promise<OrderDetailDto> {
    const order = await this.getOrThrow(orderId);
    if (order.status !== OrderStatus.DISPUTED) {
      throw new BadRequestException("Cette commande n'est pas en litige");
    }

    if (outcome === "RELEASE") {
      await this.transition(orderId, adminId, OrderStatus.RELEASED, "Litige résolu: fonds libérés");
    } else {
      await this.transition(orderId, adminId, OrderStatus.REFUNDED, "Litige résolu: remboursement");
    }
    return this.findById(adminId, orderId, true);
  }

  // Tâche planifiée (voir orders-scheduler.service.ts): confirme automatiquement la
  // réception et libère les fonds pour toute commande expédiée dont le délai est dépassé.
  async autoReleaseDueOrders(): Promise<number> {
    const dueOrders = await this.prisma.order.findMany({
      where: { status: OrderStatus.SHIPPED, autoReleaseAt: { lte: new Date() } },
      select: { id: true },
    });

    for (const { id } of dueOrders) {
      await this.confirmAndRelease(id, null);
    }

    return dueOrders.length;
  }

  async findMineAsBuyer(buyerId: string): Promise<OrderSummaryDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { buyerId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return orders.map((o) => this.toSummaryDto(o as OrderWithRelations));
  }

  async findMineAsSeller(sellerId: string): Promise<OrderSummaryDto[]> {
    const orders = await this.prisma.order.findMany({
      where: { sellerId },
      include: ORDER_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return orders.map((o) => this.toSummaryDto(o as OrderWithRelations));
  }

  async findById(userId: string, orderId: string, isAdmin = false): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    if (!isAdmin && order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException("Vous ne faites pas partie de cette commande");
    }

    const history = await this.prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });

    return this.toDetailDto(order as OrderWithRelations, history);
  }

  // --- Machine à états centrale ---------------------------------------------

  private async confirmAndRelease(orderId: string, actorId: string | null): Promise<void> {
    await this.transition(orderId, actorId, OrderStatus.DELIVERED, "Réception confirmée");
    await this.transition(orderId, actorId, OrderStatus.RELEASED, "Fonds libérés au vendeur");
  }

  private async transition(
    orderId: string,
    actorId: string | null,
    toStatus: OrderStatus,
    reason?: string,
    extraData?: { trackingNumber?: string },
  ): Promise<void> {
    let orderSnapshot: Order | null = null;

    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) {
        throw new NotFoundException("Commande introuvable");
      }
      orderSnapshot = order;

      const fromStatus = order.status as OrderStatus;
      if (!canTransitionOrder(fromStatus, toStatus)) {
        throw new BadRequestException(`Transition invalide: ${fromStatus} -> ${toStatus}`);
      }

      const now = new Date();
      const data: Prisma.OrderUpdateInput = { status: toStatus };

      switch (toStatus) {
        case OrderStatus.PAID_HELD: {
          data.paidAt = now;
          const autoReleaseDays = await this.settings.getAutoReleaseDays();
          // Le compte à rebours démarre dès le paiement; il est resynchronisé à
          // l'expédition (voir case SHIPPED) pour laisser le temps réel de livraison.
          data.autoReleaseAt = new Date(now.getTime() + autoReleaseDays * 24 * 60 * 60 * 1000);
          await tx.listing.update({ where: { id: order.listingId }, data: { status: ListingStatus.SOLD } });
          await this.recordLedger(tx, orderId, [
            { type: LedgerEntryType.CAPTURE, amountXaf: order.totalXaf, description: "Paiement encaissé" },
            { type: LedgerEntryType.HOLD, amountXaf: order.totalXaf, description: "Fonds bloqués en séquestre" },
          ]);
          break;
        }
        case OrderStatus.SHIPPED: {
          data.shippedAt = now;
          data.trackingNumber = extraData?.trackingNumber ?? null;
          const autoReleaseDays = await this.settings.getAutoReleaseDays();
          data.autoReleaseAt = new Date(now.getTime() + autoReleaseDays * 24 * 60 * 60 * 1000);
          break;
        }
        case OrderStatus.DELIVERED: {
          data.deliveredAt = now;
          break;
        }
        case OrderStatus.RELEASED: {
          data.releasedAt = now;
          const payoutXaf = order.priceXaf - order.commissionXaf + order.deliveryFeeXaf;
          await this.recordLedger(tx, orderId, [
            { type: LedgerEntryType.COMMISSION, amountXaf: order.commissionXaf, description: "Commission plateforme" },
            { type: LedgerEntryType.PAYOUT, amountXaf: payoutXaf, description: "Versement au vendeur" },
          ]);
          await this.paymentProvider.payout({
            sellerId: order.sellerId,
            amountXaf: payoutXaf,
            reason: `Commande ${order.id}`,
          });
          break;
        }
        case OrderStatus.CANCELLED: {
          data.cancelledAt = now;
          await tx.listing.update({
            where: { id: order.listingId },
            data: { status: ListingStatus.PUBLISHED },
          });
          break;
        }
        case OrderStatus.REFUNDED: {
          await this.recordLedger(tx, orderId, [
            { type: LedgerEntryType.REFUND, amountXaf: order.totalXaf, description: "Remboursement acheteur" },
          ]);
          await this.paymentProvider.refund({ orderId: order.id, amountXaf: order.totalXaf });
          break;
        }
        case OrderStatus.DISPUTED:
          break;
      }

      await tx.order.update({ where: { id: orderId }, data });
      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus, toStatus, actorId, reason },
      });
    });

    if (orderSnapshot) {
      await this.notifyTransition(orderSnapshot, toStatus, actorId);
    }
  }

  private async notifyTransition(
    order: Order,
    toStatus: OrderStatus,
    actorId: string | null,
  ): Promise<void> {
    switch (toStatus) {
      case OrderStatus.PAID_HELD:
        await this.notifications.notify({
          userId: order.sellerId,
          type: NotificationType.ORDER_PAID,
          title: "Commande payée",
          body: `Votre article s'est vendu pour ${formatXaf(order.priceXaf)}. Préparez l'expédition.`,
          data: { orderId: order.id },
          alsoEmail: true,
        });
        break;
      case OrderStatus.SHIPPED:
        await this.notifications.notify({
          userId: order.buyerId,
          type: NotificationType.ORDER_SHIPPED,
          title: "Commande expédiée",
          body: "Votre commande a été expédiée par le vendeur.",
          data: { orderId: order.id },
          alsoEmail: true,
        });
        break;
      case OrderStatus.RELEASED:
        await this.notifications.notify({
          userId: order.sellerId,
          type: NotificationType.ORDER_RELEASED,
          title: "Fonds libérés",
          body: `Les fonds de la commande (${formatXaf(order.priceXaf - order.commissionXaf + order.deliveryFeeXaf)}) ont été versés.`,
          data: { orderId: order.id },
          alsoEmail: true,
        });
        break;
      case OrderStatus.CANCELLED: {
        const recipients =
          actorId === order.buyerId
            ? [order.sellerId]
            : actorId === order.sellerId
              ? [order.buyerId]
              : [order.buyerId, order.sellerId];
        for (const userId of recipients) {
          await this.notifications.notify({
            userId,
            type: NotificationType.ORDER_CANCELLED,
            title: "Commande annulée",
            body: "Une commande a été annulée.",
            data: { orderId: order.id },
          });
        }
        break;
      }
    }
  }

  private async recordLedger(
    tx: TxClient,
    orderId: string,
    entries: Array<{ type: LedgerEntryType; amountXaf: number; description: string }>,
  ): Promise<void> {
    await tx.ledgerEntry.createMany({
      data: entries.map((entry) => ({
        orderId,
        type: entry.type,
        amountXaf: entry.amountXaf,
        description: entry.description,
      })),
    });
  }

  private async getOrThrow(orderId: string): Promise<Order> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    return order;
  }

  private toSummaryDto(order: OrderWithRelations): OrderSummaryDto {
    return {
      id: order.id,
      listingId: order.listingId,
      listingTitle: order.listing.title,
      listingCoverPhotoUrl: order.listing.photos[0]?.thumbUrl ?? null,
      buyer: order.buyer,
      seller: order.seller,
      priceXaf: order.priceXaf,
      deliveryFeeXaf: order.deliveryFeeXaf,
      commissionXaf: order.commissionXaf,
      totalXaf: order.totalXaf,
      deliveryMethod: order.deliveryMethod as DeliveryMethod,
      status: order.status as OrderStatus,
      trackingNumber: order.trackingNumber,
      autoReleaseAt: order.autoReleaseAt?.toISOString() ?? null,
      createdAt: order.createdAt.toISOString(),
    };
  }

  private toDetailDto(
    order: OrderWithRelations,
    history: Array<{ id: string; fromStatus: string; toStatus: string; reason: string | null; createdAt: Date }>,
  ): OrderDetailDto {
    return {
      ...this.toSummaryDto(order),
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      deliveryAddressText: order.deliveryAddressText,
      paidAt: order.paidAt?.toISOString() ?? null,
      shippedAt: order.shippedAt?.toISOString() ?? null,
      deliveredAt: order.deliveredAt?.toISOString() ?? null,
      releasedAt: order.releasedAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
      statusHistory: history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus as OrderStatus,
        toStatus: h.toStatus as OrderStatus,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
    };
  }
}
