import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationType, OrderStatus, ReviewDto } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { CreateReviewDto } from "./dto/create-review.dto";

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(authorId: string, orderId: string, dto: CreateReviewDto): Promise<ReviewDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException("Commande introuvable");
    }
    if (order.buyerId !== authorId && order.sellerId !== authorId) {
      throw new ForbiddenException("Vous ne faites pas partie de cette commande");
    }
    if (order.status !== OrderStatus.RELEASED) {
      throw new BadRequestException("Un avis ne peut être laissé qu'après la finalisation de la commande");
    }

    const existing = await this.prisma.review.findUnique({
      where: { orderId_authorId: { orderId, authorId } },
    });
    if (existing) {
      throw new BadRequestException("Vous avez déjà laissé un avis pour cette commande");
    }

    const targetId = authorId === order.buyerId ? order.sellerId : order.buyerId;

    const review = await this.prisma.review.create({
      data: { orderId, authorId, targetId, rating: dto.rating, comment: dto.comment },
      include: { author: { select: { firstName: true, lastName: true } } },
    });

    await this.notifications.notify({
      userId: targetId,
      type: NotificationType.REVIEW_RECEIVED,
      title: "Nouvel avis reçu",
      body: `Vous avez reçu un avis ${dto.rating}/5.`,
    });

    return this.toDto(review);
  }

  async findForTarget(targetId: string): Promise<{ reviews: ReviewDto[]; average: number | null }> {
    const reviews = await this.prisma.review.findMany({
      where: { targetId },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const average =
      reviews.length > 0
        ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10
        : null;

    return { reviews: reviews.map((r) => this.toDto(r)), average };
  }

  async hasReviewed(orderId: string, authorId: string): Promise<boolean> {
    const existing = await this.prisma.review.findUnique({
      where: { orderId_authorId: { orderId, authorId } },
    });
    return !!existing;
  }

  private toDto(review: {
    id: string;
    orderId: string;
    authorId: string;
    targetId: string;
    rating: number;
    comment: string | null;
    createdAt: Date;
    author: { firstName: string; lastName: string };
  }): ReviewDto {
    return {
      id: review.id,
      orderId: review.orderId,
      authorId: review.authorId,
      authorFirstName: review.author.firstName,
      authorLastName: review.author.lastName,
      targetId: review.targetId,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    };
  }
}
