import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { Prisma } from "@prisma/client";
import { NotificationChannel, NotificationDto, NotificationType } from "@marketplace/shared";
import { PrismaService } from "../../prisma/prisma.service";
import { NOTIFICATIONS_QUEUE, SEND_EMAIL_JOB } from "./notifications.constants";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  alsoEmail?: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE) private readonly queue: Queue,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        channel: NotificationChannel.IN_APP,
        title: input.title,
        body: input.body,
        data: (input.data ?? {}) as Prisma.InputJsonValue,
      },
    });

    if (input.alsoEmail) {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          channel: NotificationChannel.EMAIL,
          title: input.title,
          body: input.body,
          data: (input.data ?? {}) as Prisma.InputJsonValue,
        },
      });
      await this.queue.add(SEND_EMAIL_JOB, { userId: input.userId, title: input.title, body: input.body });
    }
  }

  async findMine(userId: string): Promise<NotificationDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return notifications.map((n) => this.toDto(n));
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException("Notification introuvable");
    }
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  private toDto(notification: {
    id: string;
    type: string;
    channel: string;
    title: string;
    body: string;
    data: unknown;
    readAt: Date | null;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: notification.id,
      type: notification.type as NotificationType,
      channel: notification.channel as NotificationChannel,
      title: notification.title,
      body: notification.body,
      data: (notification.data as Record<string, unknown>) ?? null,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
