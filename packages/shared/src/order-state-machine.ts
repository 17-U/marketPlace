import { OrderStatus } from "./enums";

// Transitions autorisées de la commande en séquestre.
// Source de vérité unique, utilisée par apps/api (exécution + tests) et
// potentiellement par apps/web (affichage des actions possibles).
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.CREATED]: [OrderStatus.PAID_HELD, OrderStatus.CANCELLED],
  [OrderStatus.PAID_HELD]: [OrderStatus.SHIPPED, OrderStatus.DISPUTED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.DISPUTED],
  [OrderStatus.DELIVERED]: [OrderStatus.RELEASED, OrderStatus.DISPUTED],
  [OrderStatus.RELEASED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.DISPUTED]: [OrderStatus.REFUNDED, OrderStatus.RELEASED],
  [OrderStatus.REFUNDED]: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ORDER_TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.RELEASED,
  OrderStatus.CANCELLED,
  OrderStatus.REFUNDED,
];
