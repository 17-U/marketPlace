import { Injectable } from "@nestjs/common";
import { User } from "@prisma/client";
import { PublicUser } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { phone } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(input: { phone: string; firstName: string; lastName: string }): Promise<User> {
    return this.prisma.user.create({
      data: {
        phone: input.phone,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneVerifiedAt: new Date(),
      },
    });
  }

  async markPhoneVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: new Date() },
    });
  }

  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      role: user.role as PublicUser["role"],
      locale: user.locale,
      cityId: user.cityId,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
