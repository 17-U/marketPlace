"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ReportDto } from "@marketplace/shared";
import { adminApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { AdminGuard } from "@/components/admin-guard";
import { AdminNav } from "@/components/admin-nav";

function ReportsContent() {
  const t = useTranslations("admin");
  const [reports, setReports] = useState<ReportDto[] | null>(null);

  async function refresh(accessToken: string) {
    const data = await adminApi.findAllReports(accessToken);
    setReports(data);
  }

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) return;
    refresh(tokens.accessToken);
  }, []);

  async function handleResolve(id: string, outcome: "DISMISS" | "ACTION") {
    const tokens = loadTokens();
    if (!tokens) return;
    await adminApi.resolveReport(tokens.accessToken, id, outcome);
    await refresh(tokens.accessToken);
  }

  if (!reports) return null;

  if (reports.length === 0) {
    return <p className="text-center text-clay-500">{t("reportsEmpty")}</p>;
  }

  return (
    <ul className="space-y-3">
      {reports.map((report) => (
        <li key={report.id} className="rounded-xl2 border border-clay-100 p-4">
          <p className="text-sm font-medium text-clay-900">
            {report.listingTitle ?? "—"} · {report.reason}
          </p>
          <p className="text-xs text-clay-500">
            {t("seller")}: {report.reporterFirstName} {report.reporterLastName} · {report.status}
          </p>
          {report.description && <p className="mt-1 text-sm text-clay-600">{report.description}</p>}
          {report.status === "OPEN" && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => void handleResolve(report.id, "DISMISS")}
                className="rounded-full border border-clay-200 px-3 py-1 text-xs font-medium text-clay-700 hover:bg-clay-50"
              >
                {t("dismiss")}
              </button>
              <button
                type="button"
                onClick={() => void handleResolve(report.id, "ACTION")}
                className="rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                {t("takeAction")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function AdminReportsPage() {
  const t = useTranslations("admin");

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("reportsTitle")}</h1>
      <AdminNav />
      <AdminGuard>
        <ReportsContent />
      </AdminGuard>
    </div>
  );
}
