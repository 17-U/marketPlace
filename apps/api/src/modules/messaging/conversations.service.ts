import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Conversation, Message, User } from "@prisma/client";
import {
  ConversationDetailDto,
  ConversationParticipantDto,
  ConversationSummaryDto,
  MessageDto,
  MessageType,
  NotificationType,
  OfferStatus,
} from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { formatXaf } from "../../common/utils/format-xaf";

type ConversationWithRelations = Conversation & {
  listing: { title: string; photos: { thumbUrl: string | null }[] };
  buyer: User;
  seller: User;
};

const CONVERSATION_INCLUDE = {
  listing: { select: { title: true, photos: { orderBy: { position: "asc" as const }, take: 1 } } },
  buyer: true,
  seller: true,
};

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async startOrGet(buyerId: string, listingId: string): Promise<ConversationDetailDto> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerId === buyerId) {
      throw new BadRequestException("Vous ne pouvez pas contacter votre propre annonce");
    }

    const conversation = await this.prisma.conversation.upsert({
      where: { listingId_buyerId: { listingId, buyerId } },
      update: {},
      create: { listingId, buyerId, sellerId: listing.sellerId },
      include: CONVERSATION_INCLUDE,
    });

    return this.toDetailDto(conversation as ConversationWithRelations, [], buyerId);
  }

  async listMine(userId: string): Promise<ConversationSummaryDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      include: {
        ...CONVERSATION_INCLUDE,
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { updatedAt: "desc" },
    });

    const conversationIds = conversations.map((c) => c.id);
    const unreadGroups = conversationIds.length
      ? await this.prisma.message.groupBy({
          by: ["conversationId"],
          where: { conversationId: { in: conversationIds }, senderId: { not: userId }, readAt: null },
          _count: { _all: true },
        })
      : [];
    const unreadByConversation = new Map(unreadGroups.map((g) => [g.conversationId, g._count._all]));

    return conversations.map((conversation) => ({
      ...this.toSummaryBase(conversation as ConversationWithRelations),
      lastMessage: conversation.messages[0] ? this.toMessageDto(conversation.messages[0]) : null,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
    }));
  }

  async getDetail(userId: string, conversationId: string): Promise<ConversationDetailDto> {
    const conversation = await this.getOwnedOrThrow(userId, conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });

    return this.toDetailDto(conversation, messages, userId);
  }

  async sendMessage(userId: string, conversationId: string, content: string): Promise<MessageDto> {
    const conversation = await this.getOwnedOrThrow(userId, conversationId);

    const message = await this.prisma.message.create({
      data: { conversationId, senderId: userId, type: MessageType.TEXT, content },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const recipientId = userId === conversation.buyerId ? conversation.sellerId : conversation.buyerId;
    await this.notifications.notify({
      userId: recipientId,
      type: NotificationType.NEW_MESSAGE,
      title: "Nouveau message",
      body: `${conversation.listing.title}: ${content.slice(0, 100)}`,
      data: { conversationId },
    });

    return this.toMessageDto(message);
  }

  async sendOffer(userId: string, conversationId: string, amountXaf: number): Promise<MessageDto> {
    const conversation = await this.getOwnedOrThrow(userId, conversationId);
    if (conversation.buyerId !== userId) {
      throw new ForbiddenException("Seul l'acheteur peut faire une offre");
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: MessageType.OFFER,
        offerAmountXaf: amountXaf,
        offerStatus: OfferStatus.PENDING,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.notifications.notify({
      userId: conversation.sellerId,
      type: NotificationType.NEW_OFFER,
      title: "Nouvelle offre de prix",
      body: `${conversation.listing.title}: offre de ${formatXaf(amountXaf)}`,
      data: { conversationId, messageId: message.id },
      alsoEmail: true,
    });

    return this.toMessageDto(message);
  }

  async respondToOffer(
    userId: string,
    conversationId: string,
    messageId: string,
    accept: boolean,
  ): Promise<{ offer: MessageDto; system: MessageDto }> {
    const conversation = await this.getOwnedOrThrow(userId, conversationId);
    if (conversation.sellerId !== userId) {
      throw new ForbiddenException("Seul le vendeur peut répondre à une offre");
    }

    const offerMessage = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!offerMessage || offerMessage.conversationId !== conversationId || offerMessage.type !== MessageType.OFFER) {
      throw new NotFoundException("Offre introuvable");
    }
    if (offerMessage.offerStatus !== OfferStatus.PENDING) {
      throw new BadRequestException("Cette offre a déjà été traitée");
    }

    const newStatus = accept ? OfferStatus.ACCEPTED : OfferStatus.REJECTED;
    const updatedOffer = await this.prisma.message.update({
      where: { id: messageId },
      data: { offerStatus: newStatus },
    });

    const systemMessage = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: MessageType.SYSTEM,
        content: accept
          ? `Offre de ${offerMessage.offerAmountXaf} FCFA acceptée`
          : `Offre de ${offerMessage.offerAmountXaf} FCFA refusée`,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await this.notifications.notify({
      userId: conversation.buyerId,
      type: accept ? NotificationType.OFFER_ACCEPTED : NotificationType.OFFER_REJECTED,
      title: accept ? "Offre acceptée" : "Offre refusée",
      body: `${conversation.listing.title}: votre offre de ${formatXaf(offerMessage.offerAmountXaf ?? 0)} a été ${accept ? "acceptée" : "refusée"}`,
      data: { conversationId, messageId },
      alsoEmail: true,
    });

    return { offer: this.toMessageDto(updatedOffer), system: this.toMessageDto(systemMessage) };
  }

  async markRead(userId: string, conversationId: string): Promise<void> {
    await this.getOwnedOrThrow(userId, conversationId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async isParticipant(userId: string, conversationId: string): Promise<boolean> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    return !!conversation && (conversation.buyerId === userId || conversation.sellerId === userId);
  }

  private async getOwnedOrThrow(
    userId: string,
    conversationId: string,
  ): Promise<ConversationWithRelations> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });

    if (!conversation) {
      throw new NotFoundException("Conversation introuvable");
    }
    if (conversation.buyerId !== userId && conversation.sellerId !== userId) {
      throw new ForbiddenException("Vous ne faites pas partie de cette conversation");
    }

    return conversation as ConversationWithRelations;
  }

  private toParticipantDto(user: User): ConversationParticipantDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }

  private toSummaryBase(conversation: ConversationWithRelations): Omit<
    ConversationSummaryDto,
    "lastMessage" | "unreadCount"
  > {
    return {
      id: conversation.id,
      listingId: conversation.listingId,
      listingTitle: conversation.listing.title,
      listingCoverPhotoUrl: conversation.listing.photos[0]?.thumbUrl ?? null,
      buyer: this.toParticipantDto(conversation.buyer),
      seller: this.toParticipantDto(conversation.seller),
      updatedAt: conversation.updatedAt.toISOString(),
    };
  }

  private toDetailDto(
    conversation: ConversationWithRelations,
    messages: Message[],
    userId: string,
  ): ConversationDetailDto {
    const unread = messages.filter((m) => m.senderId !== userId && !m.readAt).length;
    return {
      ...this.toSummaryBase(conversation),
      lastMessage: messages.length ? this.toMessageDto(messages[messages.length - 1]) : null,
      unreadCount: unread,
      messages: messages.map((m) => this.toMessageDto(m)),
    };
  }

  private toMessageDto(message: Message): MessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type as MessageType,
      content: message.content,
      offerAmountXaf: message.offerAmountXaf,
      offerStatus: message.offerStatus as OfferStatus | null,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
