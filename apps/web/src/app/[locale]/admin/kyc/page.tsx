"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { SellerVerificationDto } from "@marketplace/shared";
import { adminApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { AdminGuard } from "@/components/admin-guard";
import { AdminNav } from "@/components/admin-nav";

function KycContent() {
  const t = useTranslations("admin");
  const [verifications, setVerifications] = useState<SellerVerificationDto[] | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  async function refresh(accessToken: string) {
    const data = await adminApi.findPendingVerifications(accessToken);
    setVerifications(data);
  }

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) return;
    refresh(tokens.accessToken);
  }, []);

  async function handleApprove(id: string) {
    const tokens = loadTokens();
    if (!tokens) return;
    await adminApi.approveVerification(tokens.accessToken, id);
    await refresh(tokens.accessToken);
  }

  async function handleReject(id: string) {
    const tokens = loadTokens();
    if (!tokens) return;
    const reason = reasonById[id];
    if (!reason || reason.trim().length < 3) return;
    await adminApi.rejectVerification(tokens.accessToken, id, reason);
    await refresh(tokens.accessToken);
  }

  if (!verifications) return null;

  if (verifications.length === 0) {
    return <p className="text-center text-clay-500">{t("kycEmpty")}</p>;
  }

  return (
    <ul className="space-y-3">
      {verifications.map((verification) => (
        <li key={verification.id} className="rounded-xl2 border border-clay-100 p-4">
          <p className="text-sm font-medium text-clay-900">
            {verification.userFirstName} {verification.userLastName} · {verification.userPhone}
          </p>
          <div className="mt-2 flex gap-3 text-sm">
            <a
              href={verification.idCardPhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              {t("viewIdCard")}
            </a>
            <a
              href={verification.selfiePhotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:underline"
            >
              {t("viewSelfie")}
            </a>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void handleApprove(verification.id)}
              className="rounded-full bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              {t("approve")}
            </button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={reasonById[verification.id] ?? ""}
              onChange={(event) =>
                setReasonById((prev) => ({ ...prev, [verification.id]: event.target.value }))
              }
              placeholder={t("rejectReasonLabel")}
              className="flex-1 rounded-md border border-clay-100 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() => void handleReject(verification.id)}
              className="shrink-0 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
            >
              {t("reject")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function AdminKycPage() {
  const t = useTranslations("admin");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("kycTitle")}</h1>
      <AdminNav />
      <AdminGuard>
        <KycContent />
      </AdminGuard>
    </div>
  );
}
