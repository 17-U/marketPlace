import { randomBytes, randomInt, createHash } from "node:crypto";
import { BadRequestException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AuthResponse, AuthTokens, Role } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { SMS_PROVIDER, SmsProvider } from "./sms/sms-provider.interface";
import { JwtPayload } from "./types/jwt-payload.type";

const OTP_CODE_LENGTH = 6;
const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
  ) {}

  async requestOtp(phone: string): Promise<{ expiresInSeconds: number }> {
    const cooldownSeconds = this.config.get<number>("otp.resendCooldownSeconds")!;
    const expiresInMinutes = this.config.get<number>("otp.expiresInMinutes")!;

    const lastOtp = await this.prisma.otpCode.findFirst({
      where: { phone },
      orderBy: { createdAt: "desc" },
    });

    if (lastOtp) {
      const elapsedSeconds = (Date.now() - lastOtp.createdAt.getTime()) / 1000;
      if (elapsedSeconds < cooldownSeconds) {
        throw new BadRequestException(
          `Veuillez attendre ${Math.ceil(cooldownSeconds - elapsedSeconds)}s avant de redemander un code`,
        );
      }
    }

    const code = this.generateOtpCode();
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await this.prisma.otpCode.create({
      data: { phone, codeHash, expiresAt },
    });

    await this.smsProvider.send(
      phone,
      `Votre code de vérification Marketplace est ${code}. Il expire dans ${expiresInMinutes} minutes.`,
    );

    return { expiresInSeconds: expiresInMinutes * 60 };
  }

  async verifyOtp(input: {
    phone: string;
    code: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AuthResponse> {
    const maxAttempts = this.config.get<number>("otp.maxAttempts")!;

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone: input.phone, consumedAt: null },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      throw new BadRequestException("Code invalide ou expiré");
    }

    if (otp.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Code expiré, veuillez en redemander un");
    }

    if (otp.attempts >= maxAttempts) {
      throw new BadRequestException("Nombre maximal de tentatives atteint, veuillez redemander un code");
    }

    const isValid = await bcrypt.compare(input.code, otp.codeHash);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: otp.attempts + 1 },
      });
      throw new BadRequestException("Code invalide");
    }

    let user = await this.users.findByPhone(input.phone);

    if (!user && (!input.firstName || !input.lastName)) {
      // Code valide mais compte pas encore créable: on ne le consomme pas,
      // l'utilisateur peut resoumettre avec son nom sans redemander de SMS.
      throw new BadRequestException("Prénom et nom requis pour créer un compte");
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    if (!user) {
      user = await this.users.createUser({
        phone: input.phone,
        firstName: input.firstName!,
        lastName: input.lastName!,
      });
    } else if (!user.phoneVerifiedAt) {
      user = await this.users.markPhoneVerified(user.id);
    }

    const tokens = await this.issueTokens(user.id, user.role as Role);

    return {
      ...tokens,
      user: this.users.toPublicUser(user),
    };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(refreshToken);

    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Session invalide, veuillez vous reconnecter");
    }

    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new UnauthorizedException("Utilisateur introuvable");
    }

    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(user.id, user.role as Role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(userId: string, role: JwtPayload["role"]): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, role };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>("jwt.accessSecret"),
      expiresIn: this.config.get<string>("jwt.accessExpiresIn"),
    });

    const refreshToken = randomBytes(40).toString("hex");
    const tokenHash = this.hashToken(refreshToken);
    const refreshExpiresIn = this.config.get<string>("jwt.refreshExpiresIn")!;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + this.parseDurationMs(refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  private generateOtpCode(): string {
    return randomInt(0, 10 ** OTP_CODE_LENGTH).toString().padStart(OTP_CODE_LENGTH, "0");
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  // Convertit des durées simples type "30d", "15m", "1h" en millisecondes.
  private parseDurationMs(duration: string): number {
    const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
    if (!match) {
      throw new Error(`Durée invalide: ${duration}`);
    }
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const unitMs: Record<string, number> = {
      ms: 1,
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return value * unitMs[unit];
  }
}
