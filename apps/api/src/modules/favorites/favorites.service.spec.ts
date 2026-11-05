import { NotFoundException } from "@nestjs/common";
import { FavoritesService } from "./favorites.service";

function buildService() {
  const prisma = {
    listing: { findUnique: jest.fn() },
    favorite: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
  };
  const service = new FavoritesService(prisma as any);
  return { service, prisma };
}

describe("FavoritesService", () => {
  describe("add", () => {
    it("rejette une annonce introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(service.add("user-1", "listing-1")).rejects.toThrow(NotFoundException);
      expect(prisma.favorite.upsert).not.toHaveBeenCalled();
    });

    it("ajoute un favori de façon idempotente (upsert)", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ id: "listing-1", deletedAt: null });
      prisma.favorite.upsert.mockResolvedValue({});

      await service.add("user-1", "listing-1");

      expect(prisma.favorite.upsert).toHaveBeenCalledWith({
        where: { userId_listingId: { userId: "user-1", listingId: "listing-1" } },
        update: {},
        create: { userId: "user-1", listingId: "listing-1" },
      });
    });
  });

  describe("findMine", () => {
    it("mappe les favoris en résumés d'annonce avec isFavorite=true", async () => {
      const { service, prisma } = buildService();
      prisma.favorite.findMany.mockResolvedValue([
        {
          listing: {
            id: "listing-1",
            title: "Robe wax",
            priceXaf: 15000,
            condition: "VERY_GOOD",
            status: "PUBLISHED",
            cityId: "city-1",
            neighborhood: "Akwa",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            city: { nameFr: "Douala" },
            photos: [{ thumbUrl: "http://x/thumb.webp" }],
          },
        },
      ]);

      const result = await service.findMine("user-1");

      expect(result).toEqual([
        {
          id: "listing-1",
          title: "Robe wax",
          priceXaf: 15000,
          condition: "VERY_GOOD",
          status: "PUBLISHED",
          cityId: "city-1",
          cityNameFr: "Douala",
          neighborhood: "Akwa",
          coverPhotoUrl: "http://x/thumb.webp",
          createdAt: "2026-01-01T00:00:00.000Z",
          isFavorite: true,
        },
      ]);
    });
  });
});
