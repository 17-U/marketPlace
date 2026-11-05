"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AdminListingSummaryDto } from "@marketplace/shared";
import { adminApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { formatXaf } from "@/lib/format";
import { AdminGuard } from "@/components/admin-guard";
import { AdminNav } from "@/components/admin-nav";

function ListingsContent() {
  const t = useTranslations("admin");
  const [listings, setListings] = useState<AdminListingSummaryDto[] | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});

  async function refresh(accessToken: string) {
    const data = await adminApi.findAllListings(accessToken);
    setListings(data);
  }

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) return;
    refresh(tokens.accessToken);
  }, []);

  async function handleHide(id: string) {
    const tokens = loadTokens();
    if (!tokens) return;
    const reason = reasonById[id];
    if (!reason || reason.trim().length < 3) return;
    await adminApi.hideListing(tokens.accessToken, id, reason);
    await refresh(tokens.accessToken);
  }

  if (!listings) return null;

  return (
    <ul className="divide-y divide-clay-100 rounded-xl2 border border-clay-100 bg-white">
      {listings.map((listing) => (
        <li key={listing.id} className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-clay-900">{listing.title}</p>
              <p className="text-xs text-clay-500">
                {formatXaf(listing.priceXaf)} · {listing.status} · {t("seller")}:{" "}
                {listing.sellerFirstName} {listing.sellerLastName}
              </p>
            </div>
          </div>
          {listing.status !== "HIDDEN" && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={reasonById[listing.id] ?? ""}
                onChange={(event) =>
                  setReasonById((prev) => ({ ...prev, [listing.id]: event.target.value }))
                }
                placeholder={t("hideReasonLabel")}
                className="flex-1 rounded-md border border-clay-100 px-2 py-1 text-xs"
              />
              <button
                type="button"
                onClick={() => void handleHide(listing.id)}
                className="shrink-0 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
              >
                {t("hideAction")}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function AdminListingsPage() {
  const t = useTranslations("admin");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("listingsTitle")}</h1>
      <AdminNav />
      <AdminGuard>
        <ListingsContent />
      </AdminGuard>
    </div>
  );
}
