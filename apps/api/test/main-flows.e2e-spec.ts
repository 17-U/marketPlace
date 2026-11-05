import { createHmac } from "node:crypto";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import sharp from "sharp";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { SMS_PROVIDER, SmsProvider } from "../src/modules/auth/sms/sms-provider.interface";

// Parcours principaux de bout en bout: inscription (OTP), publication d'une
// annonce (avec photo traitée par le worker BullMQ réel), achat, confirmation
// de paiement (webhook signé) et versement (expédition + confirmation de
// réception -> libération des fonds).
describe("Main flows (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let config: ConfigService;
  const capturedCodes = new Map<string, string>();

  function uniquePhoneSuffix() {
    return Date.now().toString().slice(-6);
  }

  beforeAll(async () => {
    const testSmsProvider: SmsProvider = {
      send: async (phone: string, message: string) => {
        const match = message.match(/(\d{6})/);
        if (match) capturedCodes.set(phone, match[1]);
      },
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SMS_PROVIDER)
      .useValue(testSmsProvider)
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.enableShutdownHooks();
    await app.init();

    prisma = app.get(PrismaService);
    config = app.get(ConfigService);
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  async function registerAndLogin(phone: string, firstName: string, lastName: string) {
    await request(app.getHttpServer()).post("/auth/otp/request").send({ phone }).expect(200);
    const code = capturedCodes.get(phone);
    expect(code).toBeDefined();

    const verifyRes = await request(app.getHttpServer())
      .post("/auth/otp/verify")
      .send({ phone, code, firstName, lastName })
      .expect(200);

    return { accessToken: verifyRes.body.accessToken as string, user: verifyRes.body.user };
  }

  it("parcours complet: inscription -> publication -> achat -> confirmation -> versement", async () => {
    const suffix = uniquePhoneSuffix();
    const buyer = await registerAndLogin(`+237699${suffix}1`, "Test", "Buyer");
    const seller = await registerAndLogin(`+237699${suffix}2`, "Test", "Seller");

    // --- Référentiels ---
    const citiesRes = await request(app.getHttpServer()).get("/cities").expect(200);
    const categoriesRes = await request(app.getHttpServer()).get("/categories").expect(200);
    const cityId = citiesRes.body[0].id;
    const categoryId = categoriesRes.body[0].id;

    // --- Publication (création + photo + publication) ---
    const createRes = await request(app.getHttpServer())
      .post("/listings")
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({
        title: "Produit e2e",
        description: "Description suffisamment longue pour passer la validation.",
        categoryId,
        condition: "GOOD",
        priceXaf: 10000,
        cityId,
      })
      .expect(201);

    const listingId = createRes.body.id;

    const imageBuffer = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .jpeg()
      .toBuffer();

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/photos`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .attach("photo", imageBuffer, "photo.jpg")
      .expect(201);

    // Attend que le worker BullMQ/sharp ait fini de générer les variantes WebP.
    let thumbUrl: string | null = null;
    for (let attempt = 0; attempt < 20 && !thumbUrl; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const check = await request(app.getHttpServer())
        .get(`/me/listings/${listingId}`)
        .set("Authorization", `Bearer ${seller.accessToken}`)
        .expect(200);
      thumbUrl = check.body.photos[0]?.thumbUrl ?? null;
    }
    expect(thumbUrl).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/listings/${listingId}/publish`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .expect(201);

    // --- Achat ---
    const orderRes = await request(app.getHttpServer())
      .post("/orders")
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .send({
        listingId,
        deliveryMethod: "HAND_DELIVERY",
        recipientName: "Test Buyer",
        recipientPhone: buyer.user.phone,
      })
      .expect(201);

    const orderId = orderRes.body.id;
    expect(orderRes.body.status).toBe("CREATED");

    // --- Confirmation (webhook de paiement signé) ---
    const payment = await prisma.payment.findFirst({ where: { orderId } });
    expect(payment).not.toBeNull();

    const webhookSecret = config.get<string>("payment.webhookSecret")!;
    const payload = JSON.stringify({
      providerRef: payment!.providerRef,
      orderId,
      status: "SUCCEEDED",
      amountXaf: orderRes.body.totalXaf,
    });
    const signature = createHmac("sha256", webhookSecret).update(payload).digest("hex");

    await request(app.getHttpServer())
      .post("/payments/webhook")
      .set("Content-Type", "application/json")
      .set("X-Signature", signature)
      .send(payload)
      .expect(200);

    const afterPayment = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(200);
    expect(afterPayment.body.status).toBe("PAID_HELD");

    // --- Versement (expédition puis confirmation de réception) ---
    await request(app.getHttpServer())
      .post(`/orders/${orderId}/ship`)
      .set("Authorization", `Bearer ${seller.accessToken}`)
      .send({})
      .expect(201);

    const releasedRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/confirm-delivery`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .expect(201);

    expect(releasedRes.body.status).toBe("RELEASED");

    // --- Avis (uniquement possible après RELEASED) ---
    const reviewRes = await request(app.getHttpServer())
      .post(`/orders/${orderId}/reviews`)
      .set("Authorization", `Bearer ${buyer.accessToken}`)
      .send({ rating: 5, comment: "Impeccable, test e2e" })
      .expect(201);
    expect(reviewRes.body.targetId).toBe(seller.user.id);

    const profileRes = await request(app.getHttpServer())
      .get(`/users/${seller.user.id}/profile`)
      .expect(200);
    expect(profileRes.body.reviewCount).toBeGreaterThanOrEqual(1);
  }, 30_000);
});
