import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { DisputeStatus } from "@marketplace/shared";
import { DisputesService } from "./disputes.service";

function buildService() {
  const prisma: any = {
    dispute: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    disputeMessage: { create: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([{ id: "admin-1" }]) },
  };
  const s3 = { upload: jest.fn().mockResolvedValue("http://x/photo.jpg") };
  const orders = {
    markDisputed: jest.fn().mockResolvedValue({
      id: "order-1",
      buyer: { id: "buyer-1" },
      seller: { id: "seller-1" },
    }),
    resolveDispute: jest.fn().mockResolvedValue({
      id: "order-1",
      buyer: { id: "buyer-1" },
      seller: { id: "seller-1" },
    }),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };

  const service = new DisputesService(prisma, s3 as any, orders as any, notifications as any);
  return { service, prisma, s3, orders, notifications };
}

const DISPUTE_RECORD = {
  id: "dispute-1",
  orderId: "order-1",
  openedById: "buyer-1",
  reason: "Objet non reçu",
  description: "Toujours pas livré après 2 semaines",
  photoUrls: [] as string[],
  status: DisputeStatus.OPEN,
  resolvedById: null,
  resolutionNote: null,
  resolvedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  messages: [],
  order: { buyerId: "buyer-1", sellerId: "seller-1" },
};

describe("DisputesService", () => {
  describe("open", () => {
    it("refuse d'ouvrir un second litige pour la même commande", async () => {
      const { service, prisma } = buildService();
      prisma.dispute.findUnique.mockResolvedValue({ id: "existing" });

      await expect(
        service.open("buyer-1", "order-1", { reason: "x", description: "description suffisante" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("délègue la transition à OrdersService puis crée le litige et notifie vendeur+admins", async () => {
      const { service, prisma, orders, notifications } = buildService();
      prisma.dispute.findUnique.mockResolvedValue(null);
      prisma.dispute.create.mockResolvedValue({ ...DISPUTE_RECORD });

      const dispute = await service.open("buyer-1", "order-1", {
        reason: "Objet non reçu",
        description: "Toujours pas livré après 2 semaines",
      });

      expect(orders.markDisputed).toHaveBeenCalledWith("buyer-1", "order-1", "Objet non reçu");
      expect(dispute.status).toBe(DisputeStatus.OPEN);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "seller-1", type: "DISPUTE_OPENED" }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "admin-1", type: "DISPUTE_OPENED" }),
      );
    });
  });

  describe("addMessage / addPhoto", () => {
    it("rejette un utilisateur hors commande", async () => {
      const { service, prisma } = buildService();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_RECORD);

      await expect(service.addMessage("someone-else", "dispute-1", "bonjour", false)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("fait passer le litige en UNDER_REVIEW quand un admin répond", async () => {
      const { service, prisma } = buildService();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_RECORD);
      prisma.disputeMessage.create.mockResolvedValue({
        id: "msg-1",
        senderId: "admin-1",
        content: "On regarde ça",
        photoUrls: [],
        createdAt: new Date(),
      });

      await service.addMessage("admin-1", "dispute-1", "On regarde ça", true);

      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: "dispute-1" },
        data: { status: DisputeStatus.UNDER_REVIEW },
      });
    });

    it("uploade une photo et l'ajoute au tableau photoUrls", async () => {
      const { service, prisma, s3 } = buildService();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_RECORD);
      const file = { mimetype: "image/jpeg", buffer: Buffer.from("fake") } as Express.Multer.File;

      const url = await service.addPhoto("buyer-1", "dispute-1", false, file);

      expect(url).toBe("http://x/photo.jpg");
      expect(s3.upload).toHaveBeenCalled();
      expect(prisma.dispute.update).toHaveBeenCalledWith({
        where: { id: "dispute-1" },
        data: { photoUrls: { push: "http://x/photo.jpg" } },
      });
    });
  });

  describe("resolve", () => {
    it("rejette la résolution d'un litige déjà résolu", async () => {
      const { service, prisma } = buildService();
      prisma.dispute.findUnique.mockResolvedValue({
        ...DISPUTE_RECORD,
        status: DisputeStatus.RESOLVED_REFUND,
      });

      await expect(service.resolve("admin-1", "dispute-1", "REFUND", undefined)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("rejette un litige introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.dispute.findUnique.mockResolvedValue(null);

      await expect(service.resolve("admin-1", "dispute-1", "REFUND", undefined)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("délègue à OrdersService.resolveDispute et notifie les deux parties", async () => {
      const { service, prisma, orders, notifications } = buildService();
      prisma.dispute.findUnique.mockResolvedValue(DISPUTE_RECORD);
      prisma.dispute.update.mockResolvedValue({ ...DISPUTE_RECORD, status: DisputeStatus.RESOLVED_RELEASE });

      const result = await service.resolve("admin-1", "dispute-1", "RELEASE", "Preuve de livraison fournie");

      expect(orders.resolveDispute).toHaveBeenCalledWith("admin-1", "order-1", "RELEASE");
      expect(result.status).toBe(DisputeStatus.RESOLVED_RELEASE);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "buyer-1", type: "DISPUTE_RESOLVED" }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "seller-1", type: "DISPUTE_RESOLVED" }),
      );
    });
  });
});
