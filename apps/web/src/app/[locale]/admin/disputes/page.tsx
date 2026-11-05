"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { DisputeDto } from "@marketplace/shared";
import { Link } from "@/i18n/navigation";
import { adminApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { AdminGuard } from "@/components/admin-guard";
import { AdminNav } from "@/components/admin-nav";

function DisputesContent() {
  const [disputes, setDisputes] = useState<DisputeDto[] | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) return;
    adminApi.findAllDisputes(tokens.accessToken).then(setDisputes);
  }, []);

  if (!disputes) return null;

  return (
    <ul className="divide-y divide-clay-100 rounded-xl2 border border-clay-100 bg-white">
      {disputes.map((dispute) => (
        <li key={dispute.id}>
          <Link href={`/litiges/${dispute.id}`} className="block p-3 hover:bg-clay-50">
            <p className="text-sm font-medium text-clay-900">{dispute.reason}</p>
            <p className="text-xs text-clay-500">
              {dispute.status} · {new Date(dispute.createdAt).toLocaleDateString()}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function AdminDisputesPage() {
  const t = useTranslations("admin");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("disputesTitle")}</h1>
      <AdminNav />
      <AdminGuard>
        <DisputesContent />
      </AdminGuard>
    </div>
  );
}
