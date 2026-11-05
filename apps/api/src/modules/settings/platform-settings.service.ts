import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

// Paramètres modifiables par un admin en base (AppSetting), avec repli sur la
// configuration d'environnement si la ligne n'existe pas encore (premier démarrage).
@Injectable()
export class PlatformSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getCommissionPercent(): Promise<number> {
    const value = await this.getSetting("PLATFORM_COMMISSION_PERCENT");
    return value !== null ? Number(value) : this.config.get<number>("platform.commissionPercent")!;
  }

  async getAutoReleaseDays(): Promise<number> {
    const value = await this.getSetting("ORDER_AUTO_RELEASE_DAYS");
    return value !== null ? Number(value) : this.config.get<number>("platform.orderAutoReleaseDays")!;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  private async getSetting(key: string): Promise<string | null> {
    const setting = await this.prisma.appSetting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }
}
