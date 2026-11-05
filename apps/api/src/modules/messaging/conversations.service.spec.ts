import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { MessageType, OfferStatus } from "@marketplace/shared";
import { ConversationsService } from "./conversations.service";

const BASE_USER = (id: string) => ({
  id,
  firstName: "Test",
  lastName: "User",
  avatarUrl: null,
  phone: "+237600000000",
  phoneVerifiedAt: new Date(),
  email: null,
  cityId: null,
  role: "USER",
  locale: "fr",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  updatedAt: new Date("2025-01-01T00:00:00.000Z"),
  deletedAt: null,
});

const BASE_CONVERSATION = {
  id: "conv-1",
  listingId: "listing-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  listing: { title: "Robe wax", photos: [] as Array<{ thumbUrl: string | null }> },
  buyer: BASE_USER("buyer-1"),
  seller: BASE_USER("seller-1"),
};

function buildService() {
  const prisma = {
    listing: { findUnique: jest.fn() },
    conversation: { upsert: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ConversationsService(prisma as any, notifications as any);
  return { service, prisma, notifications };
}

describe("ConversationsService", () => {
  describe("startOrGet", () => {
    it("refuse qu'un vendeur contacte sa propre annonce", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ id: "listing-1", sellerId: "seller-1", deletedAt: null });

      await expect(service.startOrGet("seller-1", "listing-1")).rejects.toThrow(BadRequestException);
      expect(prisma.conversation.upsert).not.toHaveBeenCalled();
    });

    it("crée ou récupère la conversation pour un acheteur légitime", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ id: "listing-1", sellerId: "seller-1", deletedAt: null });
      prisma.conversation.upsert.mockResolvedValue(BASE_CONVERSATION);

      const result = await service.startOrGet("buyer-1", "listing-1");

      expect(result.id).toBe("conv-1");
      expect(prisma.conversation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { listingId_buyerId: { listingId: "listing-1", buyerId: "buyer-1" } },
        }),
      );
    });
  });

  describe("sendMessage", () => {
    it("rejette un utilisateur hors conversation", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);

      await expect(service.sendMessage("someone-else", "conv-1", "salut")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejette une conversation introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.sendMessage("buyer-1", "conv-1", "salut")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("crée un message TEXT pour un participant légitime", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);
      prisma.message.create.mockResolvedValue({
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "buyer-1",
        type: MessageType.TEXT,
        content: "Bonjour, toujours disponible ?",
        offerAmountXaf: null,
        offerStatus: null,
        readAt: null,
        createdAt: new Date(),
      });
      prisma.conversation.update.mockResolvedValue({});

      const message = await service.sendMessage("buyer-1", "conv-1", "Bonjour, toujours disponible ?");

      expect(message.type).toBe(MessageType.TEXT);
      expect(prisma.conversation.update).toHaveBeenCalledWith({
        where: { id: "conv-1" },
        data: { updatedAt: expect.any(Date) },
      });
    });
  });

  describe("sendOffer", () => {
    it("rejette une offre faite par le vendeur", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);

      await expect(service.sendOffer("seller-1", "conv-1", 10000)).rejects.toThrow(ForbiddenException);
    });

    it("accepte une offre faite par l'acheteur", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);
      prisma.message.create.mockResolvedValue({
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "buyer-1",
        type: MessageType.OFFER,
        content: null,
        offerAmountXaf: 10000,
        offerStatus: OfferStatus.PENDING,
        readAt: null,
        createdAt: new Date(),
      });
      prisma.conversation.update.mockResolvedValue({});

      const message = await service.sendOffer("buyer-1", "conv-1", 10000);

      expect(message.offerStatus).toBe(OfferStatus.PENDING);
      expect(message.offerAmountXaf).toBe(10000);
    });
  });

  describe("respondToOffer", () => {
    it("rejette une réponse venant de l'acheteur", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);

      await expect(
        service.respondToOffer("buyer-1", "conv-1", "msg-1", true),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejette une offre déjà traitée", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);
      prisma.message.findUnique.mockResolvedValue({
        id: "msg-1",
        conversationId: "conv-1",
        type: MessageType.OFFER,
        offerStatus: OfferStatus.ACCEPTED,
      });

      await expect(
        service.respondToOffer("seller-1", "conv-1", "msg-1", true),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepte une offre en attente et crée un message système", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);
      prisma.message.findUnique.mockResolvedValue({
        id: "msg-1",
        conversationId: "conv-1",
        type: MessageType.OFFER,
        offerStatus: OfferStatus.PENDING,
        offerAmountXaf: 10000,
      });
      prisma.message.update.mockResolvedValue({
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "seller-1",
        type: MessageType.OFFER,
        content: null,
        offerAmountXaf: 10000,
        offerStatus: OfferStatus.ACCEPTED,
        readAt: null,
        createdAt: new Date(),
      });
      prisma.message.create.mockResolvedValue({
        id: "msg-2",
        conversationId: "conv-1",
        senderId: "seller-1",
        type: MessageType.SYSTEM,
        content: "Offre de 10000 FCFA acceptée",
        offerAmountXaf: null,
        offerStatus: null,
        readAt: null,
        createdAt: new Date(),
      });
      prisma.conversation.update.mockResolvedValue({});

      const result = await service.respondToOffer("seller-1", "conv-1", "msg-1", true);

      expect(result.offer.offerStatus).toBe(OfferStatus.ACCEPTED);
      expect(result.system.type).toBe(MessageType.SYSTEM);
    });
  });

  describe("isParticipant", () => {
    it("retourne false pour une conversation introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(null);

      await expect(service.isParticipant("buyer-1", "conv-1")).resolves.toBe(false);
    });

    it("retourne true pour l'acheteur ou le vendeur", async () => {
      const { service, prisma } = buildService();
      prisma.conversation.findUnique.mockResolvedValue(BASE_CONVERSATION);

      await expect(service.isParticipant("buyer-1", "conv-1")).resolves.toBe(true);
      await expect(service.isParticipant("seller-1", "conv-1")).resolves.toBe(true);
      await expect(service.isParticipant("someone-else", "conv-1")).resolves.toBe(false);
    });
  });
});
