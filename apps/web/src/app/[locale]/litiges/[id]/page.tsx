"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DisputeDto } from "@marketplace/shared";
import { useRouter } from "@/i18n/navigation";
import { authApi, disputesApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

const STATUS_KEYS: Record<string, string> = {
  OPEN: "statusOpen",
  UNDER_REVIEW: "statusUnderReview",
  RESOLVED_RELEASE: "statusResolvedRelease",
  RESOLVED_REFUND: "statusResolvedRefund",
  CLOSED: "statusClosed",
};

export default function DisputeDetailPage() {
  const t = useTranslations("disputes");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const disputeId = params.id;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dispute, setDispute] = useState<DisputeDto | null>(null);
  const [message, setMessage] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh(accessToken: string) {
    const detail = await disputesApi.getDetail(accessToken, disputeId);
    setDispute(detail);
  }

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    authApi.me(tokens.accessToken).then((me) => {
      setCurrentUserId(me.id);
      setIsAdmin(me.role === "ADMIN");
    });
    refresh(tokens.accessToken).catch(() => setDispute(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId, router]);

  async function handleSendMessage(event: React.FormEvent) {
    event.preventDefault();
    const tokens = loadTokens();
    if (!tokens || !message.trim()) return;
    try {
      await disputesApi.addMessage(tokens.accessToken, disputeId, message.trim());
      setMessage("");
      await refresh(tokens.accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  }

  async function handleResolve(outcome: "RELEASE" | "REFUND") {
    const tokens = loadTokens();
    if (!tokens) return;
    try {
      await disputesApi.resolve(tokens.accessToken, disputeId, outcome, resolutionNote || undefined);
      await refresh(tokens.accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    }
  }

  if (!dispute || !currentUserId) return null;

  const isResolved = dispute.status === "RESOLVED_RELEASE" || dispute.status === "RESOLVED_REFUND";

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-clay-900">{t("title")}</h1>
      <p className="text-sm font-medium text-clay-600">{t(STATUS_KEYS[dispute.status] ?? dispute.status)}</p>

      <div className="mt-4 rounded-xl2 border border-clay-100 p-4">
        <p className="text-xs text-clay-500">{t("reasonLabel")}</p>
        <p className="font-medium text-clay-900">{dispute.reason}</p>
        <p className="mt-2 text-xs text-clay-500">{t("descriptionLabel")}</p>
        <p className="text-sm text-clay-700">{dispute.description}</p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-clay-900">{t("messagesTitle")}</p>
        <ul className="space-y-2">
          {dispute.messages.map((m) => (
            <li
              key={m.id}
              className={`rounded-xl2 p-3 text-sm ${
                m.senderId === currentUserId ? "bg-brand-50 text-clay-900" : "bg-clay-100 text-clay-900"
              }`}
            >
              {m.content}
            </li>
          ))}
        </ul>

        {!isResolved && (
          <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("typeMessage")}
              className="flex-1 rounded-md border border-clay-100 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("send")}
            </button>
          </form>
        )}
      </div>

      {isAdmin && !isResolved && (
        <div className="mt-6 rounded-xl2 border border-red-200 p-4">
          <textarea
            value={resolutionNote}
            onChange={(event) => setResolutionNote(event.target.value)}
            placeholder={t("resolutionNoteLabel")}
            rows={2}
            className="mb-2 w-full rounded-md border border-clay-100 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleResolve("RELEASE")}
              className="flex-1 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {t("resolveRelease")}
            </button>
            <button
              type="button"
              onClick={() => void handleResolve("REFUND")}
              className="flex-1 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              {t("resolveRefund")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
