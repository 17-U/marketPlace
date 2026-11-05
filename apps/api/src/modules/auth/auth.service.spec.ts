import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

const CONFIG_VALUES: Record<string, unknown> = {
  "otp.resendCooldownSeconds": 60,
  "otp.expiresInMinutes": 5,
  "otp.maxAttempts": 5,
  "jwt.accessSecret": "test-access-secret",
  "jwt.accessExpiresIn": "15m",
  "jwt.refreshExpiresIn": "30d",
};

function buildService() {
  const prisma = {
    otpCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const users = {
    findByPhone: jest.fn(),
    findById: jest.fn(),
    createUser: jest.fn(),
    markPhoneVerified: jest.fn(),
    toPublicUser: jest.fn((user) => ({
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: null,
      role: user.role,
      locale: "fr",
      cityId: null,
      createdAt: new Date().toISOString(),
    })),
  };

  const jwt = {
    signAsync: jest.fn().mockResolvedValue("signed-access-token"),
  };

  const config = {
    get: jest.fn((key: string) => CONFIG_VALUES[key]),
  };

  const smsProvider = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  const service = new AuthService(
    prisma as any,
    users as any,
    jwt as any,
    config as any,
    smsProvider as any,
  );

  return { service, prisma, users, jwt, config, smsProvider };
}

describe("AuthService", () => {
  describe("requestOtp", () => {
    it("crée un code OTP et l'envoie par SMS quand aucune demande récente n'existe", async () => {
      const { service, prisma, smsProvider } = buildService();
      prisma.otpCode.findFirst.mockResolvedValue(null);
      prisma.otpCode.create.mockResolvedValue({});

      const result = await service.requestOtp("+237600000010");

      expect(prisma.otpCode.create).toHaveBeenCalledTimes(1);
      expect(smsProvider.send).toHaveBeenCalledWith(
        "+237600000010",
        expect.stringContaining("Votre code de vérification"),
      );
      expect(result.expiresInSeconds).toBe(5 * 60);
    });

    it("refuse une nouvelle demande pendant la période de cooldown", async () => {
      const { service, prisma } = buildService();
      prisma.otpCode.findFirst.mockResolvedValue({
        createdAt: new Date(),
      });

      await expect(service.requestOtp("+237600000010")).rejects.toThrow(BadRequestException);
      expect(prisma.otpCode.create).not.toHaveBeenCalled();
    });
  });

  describe("verifyOtp", () => {
    it("crée un nouvel utilisateur quand le code est valide et le téléphone inconnu", async () => {
      const { service, prisma, users } = buildService();
      const codeHash = await bcrypt.hash("123456", 4);

      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        attempts: 0,
        codeHash,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.otpCode.update.mockResolvedValue({});
      users.findByPhone.mockResolvedValue(null);
      users.createUser.mockResolvedValue({
        id: "user-1",
        phone: "+237600000010",
        firstName: "Jean",
        lastName: "Mballa",
        role: "USER",
      });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.verifyOtp({
        phone: "+237600000010",
        code: "123456",
        firstName: "Jean",
        lastName: "Mballa",
      });

      expect(users.createUser).toHaveBeenCalledWith({
        phone: "+237600000010",
        firstName: "Jean",
        lastName: "Mballa",
      });
      expect(result.user.id).toBe("user-1");
      expect(result.accessToken).toBe("signed-access-token");
      expect(result.refreshToken).toHaveLength(80);
    });

    it("rejette un code invalide et incrémente le compteur de tentatives", async () => {
      const { service, prisma } = buildService();
      const codeHash = await bcrypt.hash("123456", 4);

      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        attempts: 0,
        codeHash,
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.verifyOtp({ phone: "+237600000010", code: "000000" }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.otpCode.update).toHaveBeenCalledWith({
        where: { id: "otp-1" },
        data: { attempts: 1 },
      });
    });

    it("rejette un code expiré", async () => {
      const { service, prisma } = buildService();
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        attempts: 0,
        codeHash: "irrelevant",
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyOtp({ phone: "+237600000010", code: "123456" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("exige prénom/nom pour un nouveau compte", async () => {
      const { service, prisma, users } = buildService();
      const codeHash = await bcrypt.hash("123456", 4);
      prisma.otpCode.findFirst.mockResolvedValue({
        id: "otp-1",
        attempts: 0,
        codeHash,
        expiresAt: new Date(Date.now() + 60_000),
      });
      users.findByPhone.mockResolvedValue(null);

      await expect(
        service.verifyOtp({ phone: "+237600000010", code: "123456" }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("refreshTokens", () => {
    it("rejette un refresh token inconnu", async () => {
      const { service, prisma } = buildService();
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refreshTokens("unknown-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejette un refresh token révoqué", async () => {
      const { service, prisma } = buildService();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(service.refreshTokens("revoked-token")).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("fait rotation du token et renvoie de nouveaux jetons", async () => {
      const { service, prisma, users } = buildService();
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      users.findById.mockResolvedValue({ id: "user-1", role: "USER" });

      const result = await service.refreshTokens("valid-token");

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: "rt-1" },
        data: { revokedAt: expect.any(Date) },
      });
      expect(result.accessToken).toBe("signed-access-token");
    });
  });
});
