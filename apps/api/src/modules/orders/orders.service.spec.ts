import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  DeliveryMethod,
  LedgerEntryType,
  ListingCondition,
  ListingStatus,
  OrderStatus,
  PaymentStatus,
} from "@marketplace/shared";
import { OrdersService } from "./orders.service";

const LISTING = {
  id: "listing-1",
  sellerId: "seller-1",
  title: "Robe wax",
  priceXaf: 15000,
  status: ListingStatus.PUBLISHED,
  condition: ListingCondition.VERY_GOOD,
  deletedAt: null,
};

const BUYER = { id: "buyer-1", phone: "+237600000003" };

function buildService() {
  const ledgerEntries: Array<{ type: LedgerEntryType; amountXaf: number }> = [];

  const prisma: any = {
    listing: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn() },
    order: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    payment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    webhookEvent: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    orderStatusHistory: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    ledgerEntry: {
      createMany: jest.fn((args: { data: Array<{ type: LedgerEntryType; amountXaf: number }> }) => {
        ledgerEntries.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      }),
    },
    $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
  };

  const settings = {
    getCommissionPercent: jest.fn().mockResolvedValue(8),
    getAutoReleaseDays: jest.fn().mockResolvedValue(3),
  };

  const paymentProvider = {
    initiatePayment: jest.fn().mockResolvedValue({ providerRef: "ref-1" }),
    verifyWebhookSignature: jest.fn().mockReturnValue(true),
    parseWebhookPayload: jest.fn(),
    payout: jest.fn().mockResolvedValue({ providerRef: "payout-1" }),
    refund: jest.fn().mockResolvedValue({ providerRef: "refund-1" }),
  };

  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };

  const service = new OrdersService(
    prisma,
    settings as any,
    notifications as any,
    paymentProvider as any,
  );

  return { service, prisma, settings, paymentProvider, notifications, ledgerEntries };
}

function makeOrder(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "order-1",
    listingId: "listing-1",
    buyerId: "buyer-1",
    sellerId: "seller-1",
    priceXaf: 15000,
    deliveryFeeXaf: 0,
    commissionXaf: 1200,
    totalXaf: 15000,
    deliveryMethod: DeliveryMethod.HAND_DELIVERY,
    recipientName: "Paul Eto",
    recipientPhone: "+237600000003",
    deliveryAddressText: null,
    status: OrderStatus.CREATED,
    trackingNumber: null,
    autoReleaseAt: null,
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    releasedAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    listing: { title: "Robe wax", photos: [] },
    buyer: { id: "buyer-1", firstName: "Paul", lastName: "Eto" },
    seller: { id: "seller-1", firstName: "Aïcha", lastName: "Ndongo" },
    ...overrides,
  };
}

describe("OrdersService", () => {
  describe("create", () => {
    it("calcule commission/frais/total et initie le paiement", async () => {
      const { service, prisma, paymentProvider } = buildService();
      prisma.listing.findUnique.mockResolvedValue(LISTING);
      prisma.user.findUnique.mockResolvedValue(BUYER);
      prisma.order.create.mockResolvedValue(makeOrder());
      prisma.payment.create.mockResolvedValue({});

      const result = await service.create("buyer-1", {
        listingId: "listing-1",
        deliveryMethod: DeliveryMethod.LOCAL_COURIER,
        recipientName: "Paul Eto",
        recipientPhone: "+237600000003",
      } as any);

      expect(result.id).toBe("order-1");
      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { status: ListingStatus.RESERVED },
      });
      expect(paymentProvider.initiatePayment).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: "order-1" }),
      );
    });

    it("refuse d'acheter sa propre annonce", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ ...LISTING, sellerId: "buyer-1" });

      await expect(
        service.create("buyer-1", { listingId: "listing-1", deliveryMethod: DeliveryMethod.HAND_DELIVERY } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it("refuse une annonce non publiée", async () => {
      const { service, prisma } = buildService();
      prisma.listing.findUnique.mockResolvedValue({ ...LISTING, status: ListingStatus.SOLD });

      await expect(
        service.create("buyer-1", { listingId: "listing-1", deliveryMethod: DeliveryMethod.HAND_DELIVERY } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("parcours complet CREATED -> RELEASED", () => {
    it("traite le webhook, expédie, confirme réception et libère les fonds avec le bon registre comptable", async () => {
      const { service, prisma, paymentProvider, ledgerEntries } = buildService();
      const order = makeOrder();
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.payment.findUnique.mockResolvedValue({
        id: "pay-1",
        orderId: "order-1",
        providerRef: "ref-1",
      });
      prisma.webhookEvent.findUnique.mockResolvedValue(null);
      paymentProvider.parseWebhookPayload.mockReturnValue({
        providerRef: "ref-1",
        orderId: "order-1",
        status: "SUCCEEDED",
        amountXaf: 15000,
      });

      await service.handleWebhook('{"providerRef":"ref-1"}', "valid-signature");

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: "pay-1" },
        data: expect.objectContaining({ status: PaymentStatus.SUCCEEDED }),
      });
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: OrderStatus.CREATED, toStatus: OrderStatus.PAID_HELD }),
      });
      expect(ledgerEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: LedgerEntryType.CAPTURE, amountXaf: 15000 }),
          expect.objectContaining({ type: LedgerEntryType.HOLD, amountXaf: 15000 }),
        ]),
      );

      // --- expédition par le vendeur ---
      prisma.order.findUnique.mockResolvedValue({ ...order, status: OrderStatus.PAID_HELD });
      await service.ship("seller-1", "order-1", "TRACK123");
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: OrderStatus.PAID_HELD, toStatus: OrderStatus.SHIPPED }),
      });

      // --- confirmation de réception par l'acheteur ---
      // confirmAndRelease effectue deux transitions successives (DELIVERED puis
      // RELEASED), chacune relisant la commande: le mock doit refléter la mise à
      // jour de statut entre les deux appels, sinon la 2e transition échouerait.
      let currentOrderState = { ...order, status: OrderStatus.SHIPPED };
      prisma.order.findUnique.mockImplementation(() => Promise.resolve({ ...currentOrderState }));
      prisma.order.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        currentOrderState = { ...currentOrderState, ...data };
        return Promise.resolve(currentOrderState);
      });

      await service.confirmDelivery("buyer-1", "order-1");

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: OrderStatus.SHIPPED, toStatus: OrderStatus.DELIVERED }),
      });
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ fromStatus: OrderStatus.DELIVERED, toStatus: OrderStatus.RELEASED }),
      });
      expect(ledgerEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: LedgerEntryType.COMMISSION, amountXaf: 1200 }),
          expect.objectContaining({ type: LedgerEntryType.PAYOUT, amountXaf: 15000 - 1200 }),
        ]),
      );
      expect(paymentProvider.payout).toHaveBeenCalledWith(
        expect.objectContaining({ sellerId: "seller-1", amountXaf: 15000 - 1200 }),
      );
    });
  });

  describe("transitions invalides", () => {
    it("rejette l'expédition d'une commande non payée", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.CREATED }));

      await expect(service.ship("seller-1", "order-1", "TRACK1")).rejects.toThrow(BadRequestException);
    });

    it("rejette l'expédition sans numéro de suivi pour un mode hors remise en main propre", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(
        makeOrder({ status: OrderStatus.PAID_HELD, deliveryMethod: DeliveryMethod.LOCAL_COURIER }),
      );

      await expect(service.ship("seller-1", "order-1", undefined)).rejects.toThrow(BadRequestException);
    });

    it("rejette l'expédition par quelqu'un d'autre que le vendeur", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.PAID_HELD }));

      await expect(service.ship("buyer-1", "order-1", "TRACK1")).rejects.toThrow(ForbiddenException);
    });

    it("rejette la confirmation de réception avant expédition", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.PAID_HELD }));

      await expect(service.confirmDelivery("buyer-1", "order-1")).rejects.toThrow(BadRequestException);
    });

    it("rejette l'annulation d'une commande déjà payée", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.PAID_HELD }));

      await expect(service.cancel("buyer-1", "order-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("annulation avant paiement", () => {
    it("remet l'annonce en ligne et journalise la transition", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.CREATED }));

      await service.cancel("buyer-1", "order-1");

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { status: ListingStatus.PUBLISHED },
      });
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ toStatus: OrderStatus.CANCELLED }),
      });
    });
  });

  describe("webhook: paiement échoué", () => {
    it("annule la commande et remet l'annonce en ligne", async () => {
      const { service, prisma, paymentProvider } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.CREATED }));
      prisma.payment.findUnique.mockResolvedValue({ id: "pay-1", orderId: "order-1", providerRef: "ref-1" });
      prisma.webhookEvent.findUnique.mockResolvedValue(null);
      paymentProvider.parseWebhookPayload.mockReturnValue({
        providerRef: "ref-1",
        orderId: "order-1",
        status: "FAILED",
        amountXaf: 15000,
      });

      await service.handleWebhook("{}", "sig");

      expect(prisma.listing.update).toHaveBeenCalledWith({
        where: { id: "listing-1" },
        data: { status: ListingStatus.PUBLISHED },
      });
    });
  });

  describe("webhook: sécurité et idempotence", () => {
    it("rejette une signature invalide", async () => {
      const { service, paymentProvider } = buildService();
      paymentProvider.verifyWebhookSignature.mockReturnValue(false);

      await expect(service.handleWebhook("{}", "bad-sig")).rejects.toThrow(BadRequestException);
    });

    it("ignore un événement déjà traité (idempotence)", async () => {
      const { service, prisma, paymentProvider } = buildService();
      paymentProvider.parseWebhookPayload.mockReturnValue({
        providerRef: "ref-1",
        orderId: "order-1",
        status: "SUCCEEDED",
        amountXaf: 15000,
      });
      prisma.webhookEvent.findUnique.mockResolvedValue({ processedAt: new Date() });

      await service.handleWebhook("{}", "sig");

      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it("rejette un montant de webhook incohérent et ne transitionne pas la commande", async () => {
      const { service, prisma, paymentProvider } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.CREATED, totalXaf: 15000 }));
      prisma.payment.findUnique.mockResolvedValue({ id: "pay-1", orderId: "order-1", providerRef: "ref-1" });
      prisma.webhookEvent.findUnique.mockResolvedValue(null);
      paymentProvider.parseWebhookPayload.mockReturnValue({
        providerRef: "ref-1",
        orderId: "order-1",
        status: "SUCCEEDED",
        amountXaf: 99999,
      });

      await expect(service.handleWebhook("{}", "sig")).rejects.toThrow(BadRequestException);
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe("litiges", () => {
    it("seul l'acheteur peut ouvrir un litige", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.PAID_HELD }));

      await expect(service.markDisputed("seller-1", "order-1", "Objet non reçu")).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("un admin peut résoudre un litige par remboursement", async () => {
      const { service, prisma, paymentProvider, ledgerEntries } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.DISPUTED }));

      await service.resolveDispute("admin-1", "order-1", "REFUND");

      expect(ledgerEntries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: LedgerEntryType.REFUND, amountXaf: 15000 }),
        ]),
      );
      expect(paymentProvider.refund).toHaveBeenCalledWith({ orderId: "order-1", amountXaf: 15000 });
    });

    it("un admin peut résoudre un litige en libérant les fonds", async () => {
      const { service, prisma, paymentProvider } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.DISPUTED }));

      await service.resolveDispute("admin-1", "order-1", "RELEASE");

      expect(paymentProvider.payout).toHaveBeenCalled();
    });

    it("rejette la résolution d'une commande qui n'est pas en litige", async () => {
      const { service, prisma } = buildService();
      prisma.order.findUnique.mockResolvedValue(makeOrder({ status: OrderStatus.PAID_HELD }));

      await expect(service.resolveDispute("admin-1", "order-1", "REFUND")).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("autoReleaseDueOrders", () => {
    it("libère automatiquement les commandes expédiées dont le délai est dépassé", async () => {
      const { service, prisma } = buildService();
      prisma.order.findMany.mockResolvedValue([{ id: "order-1" }, { id: "order-2" }]);
      prisma.order.findUnique
        .mockResolvedValueOnce(makeOrder({ id: "order-1", status: OrderStatus.SHIPPED }))
        .mockResolvedValueOnce(makeOrder({ id: "order-1", status: OrderStatus.DELIVERED }))
        .mockResolvedValueOnce(makeOrder({ id: "order-2", status: OrderStatus.SHIPPED }))
        .mockResolvedValueOnce(makeOrder({ id: "order-2", status: OrderStatus.DELIVERED }));

      const count = await service.autoReleaseDueOrders();

      expect(count).toBe(2);
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actorId: null, toStatus: OrderStatus.RELEASED }),
      });
    });
  });
});
