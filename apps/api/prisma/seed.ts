import { PrismaClient } from "@prisma/client";
import { CAMEROON_CITIES, DEFAULT_CATEGORIES } from "@marketplace/shared";

const prisma = new PrismaClient();

async function seedCities() {
  for (const city of CAMEROON_CITIES) {
    await prisma.city.upsert({
      where: { nameFr: city.nameFr },
      update: { nameEn: city.nameEn, region: city.region },
      create: city,
    });
  }
  console.log(`Villes seedées: ${CAMEROON_CITIES.length}`);
}

async function seedCategories() {
  for (const category of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { nameFr: category.nameFr, nameEn: category.nameEn, icon: category.icon },
      create: category,
    });
  }
  console.log(`Catégories seedées: ${DEFAULT_CATEGORIES.length}`);
}

async function seedDemoUsers() {
  const yaounde = await prisma.city.findUnique({ where: { nameFr: "Yaoundé" } });
  const douala = await prisma.city.findUnique({ where: { nameFr: "Douala" } });

  const admin = await prisma.user.upsert({
    where: { phone: "+237600000001" },
    update: {},
    create: {
      phone: "+237600000001",
      phoneVerifiedAt: new Date(),
      firstName: "Admin",
      lastName: "Marketplace",
      role: "ADMIN",
      cityId: yaounde?.id,
    },
  });

  const seller = await prisma.user.upsert({
    where: { phone: "+237600000002" },
    update: {},
    create: {
      phone: "+237600000002",
      phoneVerifiedAt: new Date(),
      firstName: "Aïcha",
      lastName: "Ndongo",
      role: "USER",
      cityId: douala?.id,
    },
  });

  const buyer = await prisma.user.upsert({
    where: { phone: "+237600000003" },
    update: {},
    create: {
      phone: "+237600000003",
      phoneVerifiedAt: new Date(),
      firstName: "Paul",
      lastName: "Eto",
      role: "USER",
      cityId: yaounde?.id,
    },
  });

  console.log(`Utilisateurs démo: admin=${admin.phone}, vendeur=${seller.phone}, acheteur=${buyer.phone}`);

  return { seller, buyer };
}

// Photos de démonstration: placehold.co (pas d'upload réel/S3 nécessaire pour le seed).
// En conditions normales, les photos passent par l'API d'upload + le worker BullMQ/sharp.
async function seedDemoListings(sellerId: string) {
  const douala = await prisma.city.findUnique({ where: { nameFr: "Douala" } });
  const yaounde = await prisma.city.findUnique({ where: { nameFr: "Yaoundé" } });
  const vetementsFemme = await prisma.category.findUnique({ where: { slug: "vetements-femme" } });
  const chaussures = await prisma.category.findUnique({ where: { slug: "chaussures" } });
  const electronique = await prisma.category.findUnique({ where: { slug: "electronique" } });
  const waxPagne = await prisma.category.findUnique({ where: { slug: "wax-pagne" } });

  if (!douala || !yaounde || !vetementsFemme || !chaussures || !electronique || !waxPagne) {
    throw new Error("Villes/catégories manquantes pour le seed des annonces démo");
  }

  const demoListings = [
    {
      title: "Robe wax taille M",
      description: "Très belle robe en wax, portée une seule fois, excellent état.",
      categoryId: waxPagne.id,
      condition: "VERY_GOOD" as const,
      priceXaf: 15000,
      cityId: douala.id,
      neighborhood: "Akwa",
      color: "f97316",
    },
    {
      title: "Sneakers Nike Air Max 42",
      description: "Pointure 42, achetées à Dubaï, portées quelques fois seulement.",
      categoryId: chaussures.id,
      condition: "GOOD" as const,
      priceXaf: 25000,
      cityId: yaounde.id,
      neighborhood: "Bastos",
      color: "0ea5e9",
    },
    {
      title: "Samsung Galaxy A14 64Go",
      description: "Téléphone en très bon état, batterie à 90%, avec chargeur d'origine.",
      categoryId: electronique.id,
      condition: "VERY_GOOD" as const,
      priceXaf: 85000,
      cityId: douala.id,
      neighborhood: "Bonapriso",
      color: "22c55e",
    },
    {
      title: "Ensemble pagne deux pièces",
      description: "Ensemble traditionnel cousu sur mesure, taille L, jamais porté.",
      categoryId: vetementsFemme.id,
      condition: "NEW" as const,
      priceXaf: 20000,
      cityId: yaounde.id,
      neighborhood: "Mvan",
      color: "a855f7",
    },
  ];

  for (const demo of demoListings) {
    const existing = await prisma.listing.findFirst({
      where: { sellerId, title: demo.title },
    });
    if (existing) continue;

    const placeholderUrl = (size: string) =>
      `https://placehold.co/${size}/${demo.color}/ffffff.webp?text=${encodeURIComponent(demo.title)}`;

    await prisma.listing.create({
      data: {
        sellerId,
        title: demo.title,
        description: demo.description,
        categoryId: demo.categoryId,
        condition: demo.condition,
        priceXaf: demo.priceXaf,
        cityId: demo.cityId,
        neighborhood: demo.neighborhood,
        status: "PUBLISHED",
        publishedAt: new Date(),
        photos: {
          create: [
            {
              originalUrl: placeholderUrl("1200x1200"),
              thumbUrl: placeholderUrl("400x400"),
              mediumUrl: placeholderUrl("800x800"),
              largeUrl: placeholderUrl("1200x1200"),
              position: 0,
            },
          ],
        },
      },
    });
  }

  console.log(`Annonces démo seedées: ${demoListings.length}`);
}

async function seedAppSettings() {
  await prisma.appSetting.upsert({
    where: { key: "PLATFORM_COMMISSION_PERCENT" },
    update: {},
    create: { key: "PLATFORM_COMMISSION_PERCENT", value: "8" },
  });
  await prisma.appSetting.upsert({
    where: { key: "ORDER_AUTO_RELEASE_DAYS" },
    update: {},
    create: { key: "ORDER_AUTO_RELEASE_DAYS", value: "3" },
  });
  console.log("Paramètres plateforme seedés");
}

async function main() {
  await seedCities();
  await seedCategories();
  await seedAppSettings();
  const { seller } = await seedDemoUsers();
  await seedDemoListings(seller.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
