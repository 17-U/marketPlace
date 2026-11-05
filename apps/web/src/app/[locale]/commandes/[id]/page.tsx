"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { OrderDetailDto } from "@marketplace/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { authApi, ordersApi, disputesApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { formatXaf } from "@/lib/format";
import { orderStatusKey } from "@/lib/labels";
import { ReviewForm } from "@/components/review-form";

export default function OrderDetailPage() {
  const t = useTranslations("orders");
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params.id;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetailDto | null>(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refresh(accessToken: string) {
    const detail = await ordersApi.getById(accessToken, orderId);
    setOrder(detail);
  }

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    authApi.me(tokens.accessToken).then((me) => setCurrentUserId(me.id));
    refresh(tokens.accessToken).catch(() => setOrder(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, router]);

  async function withAction(action: (accessToken: string) => Promise<unknown>) {
    const tokens = loadTokens();
    if (!tokens) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await action(tokens.accessToken);
      await refresh(tokens.accessToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenDispute() {
    const tokens = loadTokens();
    if (!tokens) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const dispute = await disputesApi.open(tokens.accessToken, orderId, {
        reason: disputeReason,
        description: disputeDescription,
      });
      router.push(`/litiges/${dispute.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!order || !currentUserId) return null;

  const isBuyer = currentUserId === order.buyer.id;
  const isSeller = currentUserId === order.seller.id;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-clay-900">
        {t("orderTitle")} · {order.listingTitle}
      </h1>
      <Link href={`/annonces/${order.listingId}`} className="text-xs text-brand-600 hover:underline">
        {order.listingTitle}
      </Link>

      <div className="mt-4 rounded-xl2 border border-clay-100 p-4">
        <div className="flex justify-between text-sm text-clay-600">
          <span>{t("orderTitle")}</span>
          <span className="font-medium text-clay-900">{t(orderStatusKey(order.status))}</span>
        </div>
        <div className="mt-2 flex justify-between text-sm text-clay-600">
          <span>Total</span>
          <span className="font-medium text-clay-900">{formatXaf(order.totalXaf)}</span>
        </div>
        {order.trackingNumber && (
          <div className="mt-2 flex justify-between text-sm text-clay-600">
            <span>{t("trackingLabel")}</span>
            <span>{order.trackingNumber}</span>
          </div>
        )}
        {order.autoReleaseAt && order.status === "SHIPPED" && (
          <p className="mt-2 text-xs text-clay-400">
            {t("autoReleaseNotice", { date: new Date(order.autoReleaseAt).toLocaleDateString() })}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-xl2 border border-clay-100 p-4 text-sm text-clay-600">
        <p className="font-medium text-clay-900">{t("recipient")}</p>
        <p>{order.recipientName}</p>
        <p>{order.recipientPhone}</p>
        {order.deliveryAddressText && <p>{order.deliveryAddressText}</p>}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 space-y-2">
        {isBuyer && order.status === "CREATED" && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void withAction((token) => ordersApi.cancel(token, orderId))}
            className="w-full rounded-full border border-clay-200 px-4 py-2 text-sm font-medium text-clay-700 hover:bg-clay-50"
          >
            {t("cancelAction")}
          </button>
        )}

        {isSeller && order.status === "PAID_HELD" && (
          <div className="flex gap-2">
            <input
              type="text"
              value={trackingNumber}
              onChange={(event) => setTrackingNumber(event.target.value)}
              placeholder={t("trackingPlaceholder")}
              className="flex-1 rounded-md border border-clay-100 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                void withAction((token) => ordersApi.ship(token, orderId, trackingNumber || undefined))
              }
              className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              {t("shipAction")}
            </button>
          </div>
        )}

        {isBuyer && order.status === "SHIPPED" && (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void withAction((token) => ordersApi.confirmDelivery(token, orderId))}
            className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t("confirmDeliveryAction")}
          </button>
        )}

        {isBuyer && ["PAID_HELD", "SHIPPED", "DELIVERED"].includes(order.status) && (
          <div>
            {showDisputeForm ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={disputeReason}
                  onChange={(event) => setDisputeReason(event.target.value)}
                  placeholder={t("disputeReasonLabel")}
                  maxLength={200}
                  className="w-full rounded-md border border-clay-100 px-3 py-2 text-sm"
                />
                <textarea
                  value={disputeDescription}
                  onChange={(event) => setDisputeDescription(event.target.value)}
                  placeholder={t("disputeReasonLabel")}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-md border border-clay-100 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={
                    isSubmitting || disputeReason.trim().length < 3 || disputeDescription.trim().length < 10
                  }
                  onClick={() => void handleOpenDispute()}
                  className="w-full rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {t("disputeSubmit")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDisputeForm(true)}
                className="w-full rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              >
                {t("disputeAction")}
              </button>
            )}
          </div>
        )}
      </div>

      {order.status === "RELEASED" && (isBuyer || isSeller) && (
        <div className="mt-4">
          <ReviewForm orderId={orderId} />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-clay-900">{t("history")}</p>
        <ul className="space-y-1 text-xs text-clay-500">
          {order.statusHistory.map((entry) => (
            <li key={entry.id}>
              {new Date(entry.createdAt).toLocaleString()} — {entry.fromStatus} → {entry.toStatus}
              {entry.reason ? ` (${entry.reason})` : ""}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
