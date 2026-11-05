import { BadRequestException, NotFoundException } from "@nestjs/common";
import { VerificationStatus } from "@marketplace/shared";
import { SellerVerificationService } from "./seller-verification.service";

function buildService() {
  const prisma: any = {
    sellerVerification: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn(), update: jest.fn() },
  };
  const s3 = { upload: jest.fn().mockResolvedValue("http://x/doc.jpg") };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new SellerVerificationService(prisma, s3 as any, notifications as any);
  return { service, prisma, s3, notifications };
}

const FILE = { mimetype: "image/jpeg", buffer: Buffer.from("x") } as Express.Multer.File;

const VERIFICATION_RECORD = {
  id: "verif-1",
  userId: "user-1",
  idCardPhotoUrl: "http://x/id.jpg",
  selfiePhotoUrl: "http://x/selfie.jpg",
  status: VerificationStatus.PENDING,
  rejectionReason: null,
  reviewedById: null,
  reviewedAt: null,
  createdAt: new Date(),
  user: { firstName: "Aïcha", lastName: "Ndongo", phone: "+237600000002" },
};

describe("SellerVerificationService", () => {
  describe("submit", () => {
    it("refuse une resoumission tant qu'une vérification est en cours ou validée", async () => {
      const { service, prisma } = buildService();
      prisma.sellerVerification.findUnique.mockResolvedValue({
        ...VERIFICATION_RECORD,
        status: VerificationStatus.APPROVED,
      });

      await expect(service.submit("user-1", FILE, FILE)).rejects.toThrow(BadRequestException);
    });

    it("permet de resoumettre après un refus", async () => {
      const { service, prisma } = buildService();
      prisma.sellerVerification.findUnique.mockResolvedValue({
        ...VERIFICATION_RECORD,
        status: VerificationStatus.REJECTED,
      });
      prisma.sellerVerification.upsert.mockResolvedValue({
        ...VERIFICATION_RECORD,
        status: VerificationStatus.PENDING,
      });

      const result = await service.submit("user-1", FILE, FILE);

      expect(result.status).toBe(VerificationStatus.PENDING);
    });
  });

  describe("approve / reject", () => {
    it("rejette une vérification introuvable", async () => {
      const { service, prisma } = buildService();
      prisma.sellerVerification.findUnique.mockResolvedValue(null);

      await expect(service.approve("admin-1", "verif-1")).rejects.toThrow(NotFoundException);
    });

    it("approuve et notifie l'utilisateur", async () => {
      const { service, prisma, notifications } = buildService();
      prisma.sellerVerification.findUnique.mockResolvedValue(VERIFICATION_RECORD);
      prisma.sellerVerification.update.mockResolvedValue({
        ...VERIFICATION_RECORD,
        status: VerificationStatus.APPROVED,
      });

      const result = await service.approve("admin-1", "verif-1");

      expect(result.status).toBe(VerificationStatus.APPROVED);
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", type: "SELLER_VERIFICATION_RESULT" }),
      );
    });

    it("refuse avec un motif et notifie l'utilisateur", async () => {
      const { service, prisma, notifications } = buildService();
      prisma.sellerVerification.findUnique.mockResolvedValue(VERIFICATION_RECORD);
      prisma.sellerVerification.update.mockResolvedValue({
        ...VERIFICATION_RECORD,
        status: VerificationStatus.REJECTED,
        rejectionReason: "Photo illisible",
      });

      const result = await service.reject("admin-1", "verif-1", "Photo illisible");

      expect(result.rejectionReason).toBe("Photo illisible");
      expect(notifications.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", type: "SELLER_VERIFICATION_RESULT" }),
      );
    });
  });
});
