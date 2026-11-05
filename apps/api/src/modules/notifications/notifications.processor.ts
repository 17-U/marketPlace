import { Inject } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { EMAIL_CHANNEL, EmailChannel } from "./channels/email-channel.interface";
import { NOTIFICATIONS_QUEUE, SEND_EMAIL_JOB } from "./notifications.constants";

interface SendEmailJobData {
  userId: string;
  title: string;
  body: string;
}

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL_CHANNEL) private readonly emailChannel: EmailChannel,
  ) {
    super();
  }

  async process(job: Job<SendEmailJobData>): Promise<void> {
    if (job.name !== SEND_EMAIL_JOB) return;

    const user = await this.prisma.user.findUnique({ where: { id: job.data.userId } });
    if (!user?.email) {
      return; // Pas d'email renseigné: on ignore silencieusement (in-app reste disponible).
    }

    await this.emailChannel.send(user.email, job.data.title, job.data.body);
  }
}
