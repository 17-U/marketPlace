"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SellerVerificationDto } from "@marketplace/shared";
import { useRouter } from "@/i18n/navigation";
import { sellerVerificationApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

export default function VerificationPage() {
  const t = useTranslations("verification");
  const router = useRouter();
  const [verification, setVerification] = useState<SellerVerificationDto | null | undefined>(undefined);
  const [idCard, setIdCard] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    sellerVerificationApi
      .findMine(tokens.accessToken)
      .then(setVerification)
      .catch(() => setVerification(null));
  }, [router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const tokens = loadTokens();
    if (!tokens || !idCard || !selfie) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const result = await sellerVerificationApi.submit(tokens.accessToken, idCard, selfie);
      setVerification(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (verification === undefined) return null;

  const showForm = !verification || verification.status === "REJECTED";

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-clay-900">{t("title")}</h1>
      <p className="mb-4 text-sm text-clay-600">{t("intro")}</p>

      {verification && (
        <p
          className={`mb-4 rounded-xl2 border p-3 text-sm ${
            verification.status === "APPROVED"
              ? "border-green-200 bg-green-50 text-green-700"
              : verification.status === "PENDING"
                ? "border-brand-200 bg-brand-50 text-brand-700"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {verification.status === "APPROVED"
            ? t("statusApproved")
            : verification.status === "PENDING"
              ? t("statusPending")
              : t("statusRejected", { reason: verification.rejectionReason ?? "" })}
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("idCardLabel")}</label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              required
              onChange={(event) => setIdCard(event.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("selfieLabel")}</label>
            <input
              type="file"
              accept="image/jpeg,image/png"
              required
              onChange={(event) => setSelfie(event.target.files?.[0] ?? null)}
              className="mt-1 w-full text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting || !idCard || !selfie}
            className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {verification?.status === "REJECTED" ? t("resubmit") : t("submit")}
          </button>
        </form>
      )}
    </div>
  );
}
