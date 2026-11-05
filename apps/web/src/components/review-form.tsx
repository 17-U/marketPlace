"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { reviewsApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

export function ReviewForm({ orderId }: { orderId: string }) {
  const t = useTranslations("reviews");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tokens = loadTokens();
    if (!tokens) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await reviewsApi.create(tokens.accessToken, orderId, { rating, comment: comment || undefined });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return <p className="rounded-xl2 border border-green-200 bg-green-50 p-3 text-sm text-green-700">{t("thanks")}</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl2 border border-clay-100 p-4">
      <p className="mb-2 text-sm font-medium text-clay-900">{t("leaveReview")}</p>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            className={value <= rating ? "text-xl text-brand-600" : "text-xl text-clay-200"}
            aria-label={`${value}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={t("commentLabel")}
        rows={3}
        maxLength={1000}
        className="w-full rounded-md border border-clay-100 px-3 py-2 text-sm"
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {t("submit")}
      </button>
    </form>
  );
}
