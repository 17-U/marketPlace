import { Injectable } from "@nestjs/common";
import { AdminStatsDto, ListingStatus, OrderStatus, VerificationStatus } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminStatsDto> {
    const [
      userCount,
      listingCount,
      publishedListingCount,
      orderCount,
      volumeAggregate,
      openDisputeCount,
      pendingVerificationCount,
      openReportCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.listing.count({ where: { deletedAt: null } }),
      this.prisma.listing.count({ where: { status: ListingStatus.PUBLISHED } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { status: { notIn: [OrderStatus.CREATED, OrderStatus.CANCELLED] } },
        _sum: { totalXaf: true },
      }),
      this.prisma.dispute.count({
        where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
      }),
      this.prisma.sellerVerification.count({ where: { status: VerificationStatus.PENDING } }),
      this.prisma.report.count({ where: { status: "OPEN" } }),
    ]);

    return {
      userCount,
      listingCount,
      publishedListingCount,
      orderCount,
      totalVolumeXaf: volumeAggregate._sum.totalXaf ?? 0,
      openDisputeCount,
      pendingVerificationCount,
      openReportCount,
    };
  }
}
