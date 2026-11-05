import { NotFoundException } from "@nestjs/common";
import { ReportReason, ReportStatus } from "@marketplace/shared";
import { ReportsService } from "./reports.service";

function buildService() {
  const prisma: any = {
    report: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const listings = { moderateHide: jest.fn().mockResolvedValue({}) };
  const service = new ReportsService(prisma, listings as any);
  return { service, prisma, listings };
}

const REPORT_RECORD = {
  id: "report-1",
  reporterId: "user-1",
  listingId: "listing-1",
  reason: ReportReason.COUNTERFEIT,
  description: "Semble contrefait",
  status: ReportStatus.OPEN,
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date(),
  reporter: { firstName: "Paul", lastName: "Eto" },
  listing: { title: "Sac à main" },
};

describe("ReportsService", () => {
  describe("create", () => {
    it("crée un signalement", async () => {
      const { service, prisma } = buildService();
      prisma.report.create.mockResolvedValue(REPORT_RECORD);

      const report = await service.create("user-1", {
        listingId: "listing-1",
        reason: ReportReason.COUNTERFEIT,
        description: "Semble contrefait",
      });

      expect(report.status).toBe(ReportStatus.OPEN);
      expect(report.listingTitle).toBe("Sac à main");
    });
  });

  describe("resolve", () => {
    it("rejette un signalement introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.report.findUnique.mockResolvedValue(null);

      await expect(service.resolve("admin-1", "report-1", "DISMISS")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("rejette simplement sans toucher à l'annonce", async () => {
      const { service, prisma, listings } = buildService();
      prisma.report.findUnique.mockResolvedValue(REPORT_RECORD);
      prisma.report.update.mockResolvedValue({ ...REPORT_RECORD, status: ReportStatus.DISMISSED });

      const result = await service.resolve("admin-1", "report-1", "DISMISS");

      expect(result.status).toBe(ReportStatus.DISMISSED);
      expect(listings.moderateHide).not.toHaveBeenCalled();
    });

    it("masque l'annonce quand le signalement est actionné", async () => {
      const { service, prisma, listings } = buildService();
      prisma.report.findUnique.mockResolvedValue(REPORT_RECORD);
      prisma.report.update.mockResolvedValue({ ...REPORT_RECORD, status: ReportStatus.ACTIONED });

      const result = await service.resolve("admin-1", "report-1", "ACTION");

      expect(result.status).toBe(ReportStatus.ACTIONED);
      expect(listings.moderateHide).toHaveBeenCalledWith(
        "admin-1",
        "listing-1",
        expect.stringContaining("COUNTERFEIT"),
      );
    });
  });
});
