export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";

export interface InitiatePaymentParams {
  orderId: string;
  amountXaf: number;
  payerPhone: string;
}

export interface InitiatePaymentResult {
  providerRef: string;
}

export interface WebhookEventPayload {
  providerRef: string;
  orderId: string;
  status: "SUCCEEDED" | "FAILED";
  amountXaf: number;
}

export interface PayoutParams {
  sellerId: string;
  amountXaf: number;
  reason: string;
}

export interface RefundParams {
  orderId: string;
  amountXaf: number;
}

// Interface commune à tous les agrégateurs de paiement Mobile Money. Chaque
// méthode doit être implémentée par un adaptateur concret (Mock en dev,
// MTN MoMo / Orange Money plus tard) — la logique métier ne dépend jamais
// d'un fournisseur précis.
export interface PaymentProvider {
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;

  // Vérifie la signature d'un webhook entrant à partir du corps brut de la requête.
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;

  parseWebhookPayload(rawBody: string): WebhookEventPayload;

  payout(params: PayoutParams): Promise<{ providerRef: string }>;

  refund(params: RefundParams): Promise<{ providerRef: string }>;
}
