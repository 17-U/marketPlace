"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { loadTokens } from "@/lib/auth-storage";

export function BuyButton({ listingId }: { listingId: string }) {
  const t = useTranslations("checkout");
  const router = useRouter();

  function handleClick() {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    router.push(`/checkout/${listingId}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
    >
      {t("title")}
    </button>
  );
}
