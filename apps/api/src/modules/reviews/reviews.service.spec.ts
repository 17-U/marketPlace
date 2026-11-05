import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { OrderStatus } from "@marketplace/shared";
import { ReviewsService } from "./reviews.service";

function buildService() {
  const prisma: any = {
    order: { findUnique: jest.fn() },
    review: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ReviewsService(prisma, notifications as any);
  return { service, prisma, notifications };
}

const ORDER = {
  id: "order-1",
  buyerId: "buyer-1",
  sellerId: "seller-1",
  status: OrderStatus.RELEASED,
};

describe("ReviewsService", () => {
  describe("create", () => {
    it("rejette un avis d'une commande qui n'est pas finalisée", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue({ ...ORDER, status: OrderStatus.PAID_HELD });

      await expect(
        service.create("buyer-1", "order-1", { rating: 5 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejette un utilisateur hors commande", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(ORDER);

      await expect(
        service.create("someone-else", "order-1", { rating: 5 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("rejette un deuxième avis pour la même commande par le même auteur", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(ORDER);
      prisma.review.findUnique.mockResolvedValue({ id: "existing-review" });

      await expect(
        service.create("buyer-1", "order-1", { rating: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it("crée l'avis et notifie la cible (le vendeur, si l'auteur est l'acheteur)", async () => {
      const { service, prisma, notifications } = buildService();
      prisma.order.findUnique.mockResolvedValue(ORDER);
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({
        id: "review-1",
        orderId: "order-1",
        authorId: "buyer-1",
        targetId: "seller-1",
        rating: 5,
        comment: "Impeccable",
        createdAt: new Date(),
        author: { firstName: "Paul", lastName: "Eto" },
      });

      const review = await service.create("buyer-1", "order-1", { rating: 5, comment: "Impeccable" });

      expect(review.targetId).toBe("seller-1");
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "seller-1", type: "REVIEW_RECEIVED" }),
      );
    });

    it("cible l'acheteur quand l'auteur est le vendeur", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(ORDER);
      prisma.review.findUnique.mockResolvedValue(null);
      prisma.review.create.mockResolvedValue({
        id: "review-2",
        orderId: "order-1",
        authorId: "seller-1",
        targetId: "buyer-1",
        rating: 4,
        comment: null,
        createdAt: new Date(),
        author: { firstName: "Aïcha", lastName: "Ndongo" },
      });

      const review = await service.create("seller-1", "order-1", { rating: 4 });

      expect(review.targetId).toBe("buyer-1");
      expect(prisma.review.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ targetId: "buyer-1" }) }),
      );
    });
  });

  describe("findForTarget", () => {
    it("calcule la note moyenne", async () => {
      const { service, prisma } = buildService();
      prisma.review.findMany.mockResolvedValue([
        { id: "r1", orderId: "o1", authorId: "a1", targetId: "t1", rating: 5, comment: null, createdAt: new Date(), author: { firstName: "A", lastName: "B" } },
        { id: "r2", orderId: "o2", authorId: "a2", targetId: "t1", rating: 3, comment: null, createdAt: new Date(), author: { firstName: "C", lastName: "D" } },
      ]);

      const { average, reviews } = await service.findForTarget("t1");

      expect(average).toBe(4);
      expect(reviews).toHaveLength(2);
    });

    it("retourne une moyenne nulle sans avis", async () => {
      const { service, prisma } = buildService();
      prisma.review.findMany.mockResolvedValue([]);

      const { average } = await service.findForTarget("t1");

      expect(average).toBeNull();
    });
  });
});
