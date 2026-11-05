export const CONDITION_LABELS_FR: Record<string, string> = {
  NEW: "Neuf",
  VERY_GOOD: "Très bon état",
  GOOD: "Bon état",
  FAIR: "État correct",
};

export const CONDITION_LABELS_EN: Record<string, string> = {
  NEW: "New",
  VERY_GOOD: "Very good",
  GOOD: "Good",
  FAIR: "Fair",
};

export function conditionLabel(condition: string, locale: string): string {
  const labels = locale === "en" ? CONDITION_LABELS_EN : CONDITION_LABELS_FR;
  return labels[condition] ?? condition;
}

const ORDER_STATUS_KEYS: Record<string, string> = {
  CREATED: "statusCreated",
  PAID_HELD: "statusPaidHeld",
  SHIPPED: "statusShipped",
  DELIVERED: "statusDelivered",
  RELEASED: "statusReleased",
  CANCELLED: "statusCancelled",
  DISPUTED: "statusDisputed",
  REFUNDED: "statusRefunded",
};

export function orderStatusKey(status: string): string {
  return ORDER_STATUS_KEYS[status] ?? status;
}
