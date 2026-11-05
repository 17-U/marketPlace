import { Injectable, Logger } from "@nestjs/common";
import { SmsProvider } from "./sms-provider.interface";

// Implémentation de développement: affiche le SMS dans les logs au lieu de
// l'envoyer réellement. À remplacer en production par un adaptateur
// (ex: Nexah, Twilio) implémentant la même interface SmsProvider.
@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger(ConsoleSmsProvider.name);

  async send(phone: string, message: string): Promise<void> {
    this.logger.log(`[SMS -> ${phone}] ${message}`);
  }
}
