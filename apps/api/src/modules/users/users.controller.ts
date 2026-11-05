import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { SellerProfileDto } from "@marketplace/shared";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { ListingsService } from "../listings/listings.service";
import { ReviewsService } from "../reviews/reviews.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly reviews: ReviewsService,
  ) {}

  @Public()
  @Get(":id/profile")
  async getProfile(@Param("id") id: string): Promise<SellerProfileDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: { city: true } });
    if (!user || user.deletedAt) {
      throw new NotFoundException("Utilisateur introuvable");
    }

    const [{ reviews, average }, listings] = await Promise.all([
      this.reviews.findForTarget(id),
      this.listings.findPublishedBySeller(id),
    ]);

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      city: user.city?.nameFr ?? null,
      memberSince: user.createdAt.toISOString(),
      averageRating: average,
      reviewCount: reviews.length,
      reviews,
      listings,
    };
  }
}
