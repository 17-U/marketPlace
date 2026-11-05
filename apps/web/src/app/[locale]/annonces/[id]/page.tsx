import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ApiError, listingsApi } from "@/lib/api-client";
import { formatXaf } from "@/lib/format";
import { conditionLabel } from "@/lib/labels";
import { FavoriteButton } from "@/components/favorite-button";
import { WhatsappShareButton } from "@/components/whatsapp-share-button";
import { ContactSellerButton } from "@/components/contact-seller-button";
import { BuyButton } from "@/components/buy-button";

interface ListingPageProps {
  params: Promise<{ locale: string; id: string }>;
}

async function getListingOrNull(id: string) {
  try {
    return await listingsApi.getById(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingOrNull(id);

  if (!listing) {
    return { title: "Annonce introuvable" };
  }

  const image = listing.photos[0]?.largeUrl ?? undefined;

  return {
    title: `${listing.title} - ${formatXaf(listing.priceXaf)}`,
    description: listing.description.slice(0, 160),
    openGraph: {
      title: listing.title,
      description: listing.description.slice(0, 160),
      images: image ? [{ url: image, width: 800, height: 800 }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: listing.title,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ListingPage({ params }: ListingPageProps) {
  const { id, locale } = await params;
  const listing = await getListingOrNull(id);
  const t = await getTranslations("listing");

  if (!listing) {
    notFound();
  }

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";
  const listingUrl = `${webUrl}/${locale}/annonces/${listing.id}`;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <div className="relative aspect-square w-full overflow-hidden rounded-xl2 bg-clay-100">
            {listing.photos[0] ? (
              <Image
                src={listing.photos[0].largeUrl ?? listing.photos[0].mediumUrl ?? ""}
                alt={listing.title}
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover"
                priority
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl">📦</div>
            )}
          </div>
          {listing.photos.length > 1 && (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {listing.photos.slice(1).map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-md bg-clay-100"
                >
                  {photo.thumbUrl && (
                    <Image src={photo.thumbUrl} alt="" fill sizes="80px" className="object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-xl font-bold text-clay-900">{listing.title}</h1>
          <p className="mt-2 text-2xl font-semibold text-brand-700">
            {formatXaf(listing.priceXaf, locale === "en" ? "en" : "fr")}
          </p>
          <p className="mt-1 text-sm text-clay-500">
            {conditionLabel(listing.condition, locale)} · {listing.cityNameFr}
            {listing.neighborhood ? `, ${listing.neighborhood}` : ""}
          </p>
          <p className="mt-1 text-xs text-clay-400">{t("views", { count: listing.viewsCount })}</p>

          <p className="mt-4 whitespace-pre-line text-sm text-clay-700">{listing.description}</p>

          {listing.status === "PUBLISHED" && (
            <div className="mt-6">
              <BuyButton listingId={listing.id} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <FavoriteButton listingId={listing.id} />
            <WhatsappShareButton title={listing.title} url={listingUrl} />
          </div>

          <div className="mt-6 rounded-xl2 border border-clay-100 p-4">
            <p className="text-xs text-clay-500">{t("soldBy")}</p>
            <Link href={`/vendeurs/${listing.seller.id}`} className="font-medium text-clay-900 hover:text-brand-700">
              {listing.seller.firstName} {listing.seller.lastName}
            </Link>
            <p className="text-xs text-clay-400">
              {t("memberSince", { year: new Date(listing.seller.createdAt).getFullYear() })}
            </p>
            <div className="mt-3">
              <ContactSellerButton listingId={listing.id} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
