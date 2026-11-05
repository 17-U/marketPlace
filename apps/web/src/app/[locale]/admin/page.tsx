"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminStatsDto } from "@marketplace/shared";
import { adminApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { formatXaf } from "@/lib/format";
import { AdminGuard } from "@/components/admin-guard";
import { AdminNav } from "@/components/admin-nav";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl2 border border-clay-100 p-4">
      <p className="text-xs text-clay-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-clay-900">{value}</p>
    </div>
  );
}

function DashboardContent() {
  const t = useTranslations("admin");
  const [stats, setStats] = useState<AdminStatsDto | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) return;
    adminApi.getStats(tokens.accessToken).then(setStats);
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label={t("users")} value={stats.userCount} />
      <StatCard label={t("listings")} value={stats.listingCount} />
      <StatCard label={t("publishedListings")} value={stats.publishedListingCount} />
      <StatCard label={t("orders")} value={stats.orderCount} />
      <StatCard label={t("volume")} value={formatXaf(stats.totalVolumeXaf)} />
      <StatCard label={t("openDisputes")} value={stats.openDisputeCount} />
      <StatCard label={t("pendingVerifications")} value={stats.pendingVerificationCount} />
      <StatCard label={t("openReports")} value={stats.openReportCount} />
    </div>
  );
}

export default function AdminDashboardPage() {
  const t = useTranslations("admin");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("dashboardTitle")}</h1>
      <AdminNav />
      <AdminGuard>
        <DashboardContent />
      </AdminGuard>
    </div>
  );
}
