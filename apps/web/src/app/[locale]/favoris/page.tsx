"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ListingSummaryDto } from "@marketplace/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { favoritesApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { ListingCard } from "@/components/listing-card";

export default function FavoritesPage() {
  const t = useTranslations("favorites");
  const router = useRouter();
  const [favorites, setFavorites] = useState<ListingSummaryDto[] | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    favoritesApi
      .findMine(tokens.accessToken)
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, [router]);

  if (favorites === null) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("title")}</h1>

      {favorites.length === 0 ? (
        <div className="text-center text-clay-500">
          <p>{t("empty")}</p>
          <Link href="/recherche" className="mt-2 inline-block text-brand-600 hover:underline">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {favorites.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
