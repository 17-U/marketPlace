import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { usersApi, ApiError } from "@/lib/api-client";
import { ListingCard } from "@/components/listing-card";

async function getProfileOrNull(id: string) {
  try {
    return await usersApi.getProfile(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const profile = await getProfileOrNull(id);
  const t = await getTranslations("profile");

  if (!profile) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">
          {profile.firstName[0]}
          {profile.lastName[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-clay-900">
            {profile.firstName} {profile.lastName}
          </h1>
          <p className="text-sm text-clay-500">
            {t("memberSince", { year: new Date(profile.memberSince).getFullYear() })}
            {profile.city ? ` · ${profile.city}` : ""}
          </p>
          {profile.averageRating !== null && (
            <p className="mt-1 text-sm text-brand-700">
              ★ {t("ratingLabel", { rating: profile.averageRating, count: profile.reviewCount })}
            </p>
          )}
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold text-clay-900">{t("listingsTitle")}</h2>
      {profile.listings.length === 0 ? (
        <p className="text-sm text-clay-500">{t("noListings")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {profile.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} locale={locale} />
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-lg font-bold text-clay-900">{t("reviewsTitle")}</h2>
      {profile.reviews.length === 0 ? (
        <p className="text-sm text-clay-500">{t("noReviews")}</p>
      ) : (
        <ul className="space-y-3">
          {profile.reviews.map((review) => (
            <li key={review.id} className="rounded-xl2 border border-clay-100 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-clay-900">
                  {review.authorFirstName} {review.authorLastName}
                </p>
                <p className="text-brand-700">{"★".repeat(review.rating)}</p>
              </div>
              {review.comment && <p className="mt-1 text-sm text-clay-600">{review.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
