import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ListingCondition, ListingStatus } from "@marketplace/shared";
import { ListingsService } from "./listings.service";

const BASE_LISTING = {
  id: "listing-1",
  sellerId: "seller-1",
  title: "Robe wax",
  description: "Une belle robe",
  categoryId: "cat-1",
  brand: null,
  size: "M",
  condition: ListingCondition.VERY_GOOD,
  priceXaf: 15000,
  cityId: "city-1",
  neighborhood: "Akwa",
  status: ListingStatus.DRAFT,
  viewsCount: 0,
  publishedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  deletedAt: null,
  photos: [] as Array<{ id: string; thumbUrl: string | null }>,
  seller: {
    id: "seller-1",
    firstName: "Aïcha",
    lastName: "Ndongo",
    avatarUrl: null,
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
  },
  city: { nameFr: "Douala" },
};

function buildService() {
  const prisma = {
    listing: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ListingsService(prisma as any, notifications as any);
  return { service, prisma, notifications };
}

describe("ListingsService", () => {
  describe("publish", () => {
    it("refuse de publier une annonce sans photo", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ ...BASE_LISTING, photos: [] });

      await expect(service.publish("seller-1", "listing-1")).rejects.toThrow(BadRequestException);
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it("publie une annonce qui a au moins une photo", async () => {
      const { service, prisma } = buildService();
      const withPhoto = {
        ...BASE_LISTING,
        photos: [{ id: "photo-1", thumbUrl: "http://x/thumb.webp" }],
      };
      prisma.listing.findUnique.mockResolvedValue(withPhoto);
      prisma.listing.update.mockResolvedValue({
        ...withPhoto,
        status: ListingStatus.PUBLISHED,
        publishedAt: new Date(),
      });

      const result = await service.publish("seller-1", "listing-1");

      expect(result.status).toBe(ListingStatus.PUBLISHED);
      expect(prisma.listing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "listing-1" },
          data: expect.objectContaining({ status: ListingStatus.PUBLISHED }),
        }),
      );
    });

    it("rejette un non-propriétaire", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue(BASE_LISTING);

      await expect(service.publish("someone-else", "listing-1")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("rejette une annonce introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.publish("seller-1", "listing-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("refuse de modifier une annonce vendue", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ ...BASE_LISTING, status: ListingStatus.SOLD });

      await expect(
        service.update("seller-1", "listing-1", { title: "Nouveau titre" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("findPublicById", () => {
    it("masque une annonce non publiée à un visiteur anonyme", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ ...BASE_LISTING, status: ListingStatus.DRAFT });

      await expect(service.findPublicById("listing-1")).rejects.toThrow(NotFoundException);
    });

    it("laisse le propriétaire voir son propre brouillon", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ ...BASE_LISTING, status: ListingStatus.DRAFT });

      const result = await service.findPublicById("listing-1", "seller-1");

      expect(result.id).toBe("listing-1");
      expect(prisma.listing.update).not.toHaveBeenCalled();
    });

    it("incrémente les vues pour un visiteur non-propriétaire sur une annonce publiée", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({
        ...BASE_LISTING,
        status: ListingStatus.PUBLISHED,
      });
      prisma.listing.update.mockResolvedValue({});

      await service.findPublicById("listing-1", "someone-else");

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { viewsCount: { increment: 1 } },
      });
    });
  });

  describe("softDelete", () => {
    it("rejette un non-propriétaire", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue(BASE_LISTING);

      await expect(service.softDelete("someone-else", "listing-1")).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
