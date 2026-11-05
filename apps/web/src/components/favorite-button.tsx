"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { favoritesApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { useRouter } from "@/i18n/navigation";

export function FavoriteButton({ listingId }: { listingId: string }) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) return;

    favoritesApi
      .findMine(tokens.accessToken)
      .then((favorites) => setIsFavorite(favorites.some((f) => f.id === listingId)))
      .catch(() => undefined);
  }, [listingId]);

  async function toggle() {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    try {
      if (isFavorite) {
        await favoritesApi.remove(tokens.accessToken, listingId);
        setIsFavorite(false);
      } else {
        await favoritesApi.add(tokens.accessToken, listingId);
        setIsFavorite(true);
      }
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={isLoading}
      className="rounded-full border border-clay-100 px-4 py-2 text-sm font-medium text-clay-700 hover:bg-clay-50 disabled:opacity-60"
    >
      {isFavorite ? `♥ ${t("removeFavorite")}` : `♡ ${t("addFavorite")}`}
    </button>
  );
}
