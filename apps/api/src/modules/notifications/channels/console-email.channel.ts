import { Injectable, Logger } from "@nestjs/common";
import { EmailChannel } from "./email-channel.interface";

// Implémentation de développement: affiche l'email dans les logs au lieu de
// l'envoyer. À remplacer en production par un adaptateur SMTP/API email réel,
// implémentant la même interface EmailChannel.
@Injectable()
export class ConsoleEmailChannel implements EmailChannel {
  private readonly logger = new Logger(ConsoleEmailChannel.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[EMAIL -> ${to}] ${subject}\n${body}`);
  }
}
