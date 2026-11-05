import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentProvider,
  PayoutParams,
  RefundParams,
  WebhookEventPayload,
} from "./payment-provider.interface";

// Implémentation de développement: ne contacte aucun agrégateur réel. Les
// webhooks sont simulés en signant le payload avec le même secret partagé
// (PAYMENT_WEBHOOK_SECRET) qu'utiliserait un vrai fournisseur.
@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(MockPaymentProvider.name);

  constructor(private readonly config: ConfigService) {}

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const providerRef = `mock_${randomUUID()}`;
    this.logger.log(
      `[MOCK] Paiement initié: ${params.amountXaf} FCFA depuis ${params.payerPhone} (commande ${params.orderId}) -> ref ${providerRef}`,
    );
    return { providerRef };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!signatureHeader) return false;
    const expected = this.sign(rawBody);
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(signatureHeader);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  parseWebhookPayload(rawBody: string): WebhookEventPayload {
    try {
      const data = JSON.parse(rawBody);
      if (!data.providerRef || !data.orderId || !data.status || typeof data.amountXaf !== "number") {
        throw new Error("champs manquants");
      }
      return data as WebhookEventPayload;
    } catch {
      throw new BadRequestException("Payload de webhook invalide");
    }
  }

  async payout(params: PayoutParams): Promise<{ providerRef: string }> {
    const providerRef = `mock_payout_${randomUUID()}`;
    this.logger.log(
      `[MOCK] Versement de ${params.amountXaf} FCFA au vendeur ${params.sellerId} (${params.reason}) -> ref ${providerRef}`,
    );
    return { providerRef };
  }

  async refund(params: RefundParams): Promise<{ providerRef: string }> {
    const providerRef = `mock_refund_${randomUUID()}`;
    this.logger.log(
      `[MOCK] Remboursement de ${params.amountXaf} FCFA pour la commande ${params.orderId} -> ref ${providerRef}`,
    );
    return { providerRef };
  }

  private sign(rawBody: string): string {
    const secret = this.config.get<string>("payment.webhookSecret")!;
    return createHmac("sha256", secret).update(rawBody).digest("hex");
  }
}
