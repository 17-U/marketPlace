import { Injectable, NotFoundException } from "@nestjs/common";
import { Report } from "@prisma/client";
import { ReportDto, ReportReason, ReportStatus } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { ListingsService } from "../listings/listings.service";
import { CreateReportDto } from "./dto/create-report.dto";

type ReportWithRelations = Report & {
  reporter: { firstName: string; lastName: string };
  listing: { title: string } | null;
};

const INCLUDE = {
  reporter: { select: { firstName: true, lastName: true } },
  listing: { select: { title: true } },
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
  ) {}

  async create(reporterId: string, dto: CreateReportDto): Promise<ReportDto> {
    const report = await this.prisma.report.create({
      data: {
        reporterId,
        listingId: dto.listingId,
        reason: dto.reason,
        description: dto.description,
        status: ReportStatus.OPEN,
      },
      include: INCLUDE,
    });

    return this.toDto(report);
  }

  async findAllForAdmin(): Promise<ReportDto[]> {
    const reports = await this.prisma.report.findMany({
      include: INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return reports.map((r) => this.toDto(r));
  }

  async resolve(adminId: string, reportId: string, outcome: "DISMISS" | "ACTION"): Promise<ReportDto> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException("Signalement introuvable");
    }

    if (outcome === "ACTION" && report.listingId) {
      await this.listings.moderateHide(
        adminId,
        report.listingId,
        `Signalement: ${report.reason}`,
      );
    }

    const updated = await this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: outcome === "ACTION" ? ReportStatus.ACTIONED : ReportStatus.DISMISSED,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
      include: INCLUDE,
    });

    return this.toDto(updated);
  }

  private toDto(report: ReportWithRelations): ReportDto {
    return {
      id: report.id,
      reporterId: report.reporterId,
      reporterFirstName: report.reporter.firstName,
      reporterLastName: report.reporter.lastName,
      listingId: report.listingId,
      listingTitle: report.listing?.title ?? null,
      reason: report.reason as ReportReason,
      description: report.description,
      status: report.status as ReportStatus,
      resolvedById: report.resolvedById,
      resolvedAt: report.resolvedAt?.toISOString() ?? null,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
