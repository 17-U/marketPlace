"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { conversationsApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

export function ContactSellerButton({ listingId }: { listingId: string }) {
  const t = useTranslations("listing");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const conversation = await conversationsApi.start(tokens.accessToken, listingId);
      router.push(`/messages/${conversation.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("contactSoon"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={isLoading}
        className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {t("contactSeller")}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
