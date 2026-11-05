import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Listing, ListingPhoto } from "@prisma/client";
import {
  AdminListingSummaryDto,
  ListingDetailDto,
  ListingStatus,
  ListingSummaryDto,
  NotificationType,
} from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateListingDto } from "./dto/create-listing.dto";
import { UpdateListingDto } from "./dto/update-listing.dto";

type ListingWithRelations = Listing & {
  photos: ListingPhoto[];
  seller: { id: string; firstName: string; lastName: string; avatarUrl: string | null; createdAt: Date };
  city: { nameFr: string };
};

const LISTING_WITH_RELATIONS_INCLUDE = {
  photos: { orderBy: { position: "asc" as const } },
  seller: {
    select: { id: true, firstName: true, lastName: true, avatarUrl: true, createdAt: true },
  },
  city: { select: { nameFr: true } },
};

@Injectable()
export class ListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(sellerId: string, dto: CreateListingDto): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.create({
      data: {
        sellerId,
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        brand: dto.brand,
        size: dto.size,
        condition: dto.condition,
        priceXaf: dto.priceXaf,
        cityId: dto.cityId,
        neighborhood: dto.neighborhood,
        status: ListingStatus.DRAFT,
      },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    return this.toDetailDto(listing as ListingWithRelations);
  }

  async update(sellerId: string, listingId: string, dto: UpdateListingDto): Promise<ListingDetailDto> {
    const listing = await this.getOwnedOrThrow(sellerId, listingId);

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Impossible de modifier une annonce vendue");
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { ...dto },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    return this.toDetailDto(updated as ListingWithRelations);
  }

  async publish(sellerId: string, listingId: string): Promise<ListingDetailDto> {
    const listing = await this.getOwnedOrThrow(sellerId, listingId);

    if (listing.photos.length === 0) {
      throw new BadRequestException("Ajoutez au moins une photo avant de publier l'annonce");
    }
    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Cette annonce est déjà vendue");
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: {
        status: ListingStatus.PUBLISHED,
        publishedAt: listing.publishedAt ?? new Date(),
      },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    return this.toDetailDto(updated as ListingWithRelations);
  }

  async hide(sellerId: string, listingId: string): Promise<ListingDetailDto> {
    const listing = await this.getOwnedOrThrow(sellerId, listingId);

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Impossible de masquer une annonce vendue");
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.HIDDEN },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    return this.toDetailDto(updated as ListingWithRelations);
  }

  async moderateHide(adminId: string, listingId: string, reason: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });
    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.HIDDEN },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    await this.notifications.notify({
      userId: listing.sellerId,
      type: NotificationType.LISTING_MODERATED,
      title: "Annonce masquée",
      body: `Votre annonce "${listing.title}" a été masquée par un modérateur: ${reason}`,
      alsoEmail: true,
    });

    return this.toDetailDto(updated as ListingWithRelations);
  }

  async findAllForAdmin(): Promise<AdminListingSummaryDto[]> {
    const listings = await this.prisma.listing.findMany({
      include: LISTING_WITH_RELATIONS_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return listings.map((listing) => ({
      ...this.toSummaryDto(listing as ListingWithRelations),
      sellerFirstName: (listing as ListingWithRelations).seller.firstName,
      sellerLastName: (listing as ListingWithRelations).seller.lastName,
    }));
  }

  async markSold(sellerId: string, listingId: string): Promise<ListingDetailDto> {
    await this.getOwnedOrThrow(sellerId, listingId);

    const updated = await this.prisma.listing.update({
      where: { id: listingId },
      data: { status: ListingStatus.SOLD },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    return this.toDetailDto(updated as ListingWithRelations);
  }

  async softDelete(sellerId: string, listingId: string): Promise<void> {
    await this.getOwnedOrThrow(sellerId, listingId);

    await this.prisma.listing.update({
      where: { id: listingId },
      data: { deletedAt: new Date(), status: ListingStatus.HIDDEN },
    });
  }

  async findOwned(sellerId: string, listingId: string): Promise<ListingDetailDto> {
    const listing = await this.getOwnedOrThrow(sellerId, listingId);
    return this.toDetailDto(listing);
  }

  async findMine(sellerId: string): Promise<ListingSummaryDto[]> {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId, deletedAt: null },
      include: LISTING_WITH_RELATIONS_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return listings.map((listing) => this.toSummaryDto(listing as ListingWithRelations));
  }

  async findPublishedBySeller(sellerId: string): Promise<ListingSummaryDto[]> {
    const listings = await this.prisma.listing.findMany({
      where: { sellerId, status: ListingStatus.PUBLISHED, deletedAt: null },
      include: LISTING_WITH_RELATIONS_INCLUDE,
      orderBy: { createdAt: "desc" },
    });

    return listings.map((listing) => this.toSummaryDto(listing as ListingWithRelations));
  }

  async findPublicById(listingId: string, viewerId?: string): Promise<ListingDetailDto> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }

    const isOwner = viewerId === listing.sellerId;
    if (listing.status !== ListingStatus.PUBLISHED && !isOwner) {
      throw new NotFoundException("Annonce introuvable");
    }

    if (!isOwner) {
      // Fire-and-forget: ne bloque pas la réponse pour un simple compteur de vues.
      this.prisma.listing
        .update({ where: { id: listingId }, data: { viewsCount: { increment: 1 } } })
        .catch(() => undefined);
    }

    return this.toDetailDto(listing as ListingWithRelations);
  }

  private async getOwnedOrThrow(sellerId: string, listingId: string): Promise<ListingWithRelations> {
    const listing = await this.prisma.listing.findUnique({
      where: { id: listingId },
      include: LISTING_WITH_RELATIONS_INCLUDE,
    });

    if (!listing || listing.deletedAt) {
      throw new NotFoundException("Annonce introuvable");
    }
    if (listing.sellerId !== sellerId) {
      throw new ForbiddenException("Vous n'êtes pas le propriétaire de cette annonce");
    }

    return listing as ListingWithRelations;
  }

  private toSummaryDto(listing: ListingWithRelations): ListingSummaryDto {
    return {
      id: listing.id,
      title: listing.title,
      priceXaf: listing.priceXaf,
      condition: listing.condition as ListingSummaryDto["condition"],
      status: listing.status as ListingStatus,
      cityId: listing.cityId,
      cityNameFr: listing.city.nameFr,
      neighborhood: listing.neighborhood,
      coverPhotoUrl: listing.photos[0]?.thumbUrl ?? null,
      createdAt: listing.createdAt.toISOString(),
    };
  }

  private toDetailDto(listing: ListingWithRelations): ListingDetailDto {
    return {
      ...this.toSummaryDto(listing),
      description: listing.description,
      brand: listing.brand,
      size: listing.size,
      categoryId: listing.categoryId,
      viewsCount: listing.viewsCount,
      photos: listing.photos.map((photo) => ({
        id: photo.id,
        thumbUrl: photo.thumbUrl,
        mediumUrl: photo.mediumUrl,
        largeUrl: photo.largeUrl,
        position: photo.position,
      })),
      seller: {
        id: listing.seller.id,
        firstName: listing.seller.firstName,
        lastName: listing.seller.lastName,
        avatarUrl: listing.seller.avatarUrl,
        createdAt: listing.seller.createdAt.toISOString(),
      },
    };
  }
}
