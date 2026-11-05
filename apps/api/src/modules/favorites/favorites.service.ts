import { Injectable, NotFoundException } from "@nestjs/common";
import { ListingSummaryDto } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async add(userId: string, listingId: string): Promise<void> {
    const listing = await this.prisma.listing.findUnique({ where: { id: listingId } });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }

    await this.prisma.favorite.upsert({
      where: { userId_listingId: { userId, listingId } },
      update: {},
      create: { userId, listingId },
    });
  }

  async remove(userId: string, listingId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
  }

  async findMine(userId: string): Promise<ListingSummaryDto[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId, listing: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      include: {
        listing: {
          include: {
            photos: { orderBy: { position: "asc" }, take: 1 },
            city: { select: { nameFr: true } },
          },
        },
      },
    });

    return favorites.map(({ listing }) => ({
      id: listing.id,
      title: listing.title,
      priceXaf: listing.priceXaf,
      condition: listing.condition as ListingSummaryDto["condition"],
      status: listing.status as ListingSummaryDto["status"],
      cityId: listing.cityId,
      cityNameFr: listing.city.nameFr,
      neighborhood: listing.neighborhood,
      coverPhotoUrl: listing.photos[0]?.thumbUrl ?? null,
      createdAt: listing.createdAt.toISOString(),
      isFavorite: true,
    }));
  }
}
