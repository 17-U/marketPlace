"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { DELIVERY_FEES_XAF, DeliveryMethod, ListingDetailDto } from "@marketplace/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { listingsApi, ordersApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { formatXaf } from "@/lib/format";

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const router = useRouter();
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;

  const [listing, setListing] = useState<ListingDetailDto | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(DeliveryMethod.HAND_DELIVERY);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    listingsApi.getById(listingId).then(setListing).catch(() => setListing(null));
  }, [listingId, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }

    const formData = new FormData(event.currentTarget);
    setError(null);
    setIsSubmitting(true);

    try {
      const order = await ordersApi.create(tokens.accessToken, {
        listingId,
        deliveryMethod,
        recipientName: formData.get("recipientName"),
        recipientPhone: formData.get("recipientPhone"),
        deliveryAddressText: formData.get("deliveryAddressText") || undefined,
      });
      setCreatedOrderId(order.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!listing) return null;

  if (createdOrderId) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-green-700">{t("successTitle")}</h1>
        <p className="mt-2 text-sm text-clay-600">{t("successBody")}</p>
        <Link
          href={`/commandes/${createdOrderId}`}
          className="mt-6 inline-block rounded-full bg-brand-600 px-6 py-2 font-medium text-white hover:bg-brand-700"
        >
          {t("viewOrder")}
        </Link>
      </div>
    );
  }

  const deliveryFeeXaf = DELIVERY_FEES_XAF[deliveryMethod];
  const totalXaf = listing.priceXaf + deliveryFeeXaf;

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-clay-700">
            {t("deliveryMethodLabel")}
          </label>
          <select
            value={deliveryMethod}
            onChange={(event) => setDeliveryMethod(event.target.value as DeliveryMethod)}
            className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
          >
            <option value={DeliveryMethod.HAND_DELIVERY}>{t("handDelivery")}</option>
            <option value={DeliveryMethod.LOCAL_COURIER}>{t("localCourier")}</option>
            <option value={DeliveryMethod.TRAVEL_AGENCY}>{t("travelAgency")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-clay-700">
            {t("recipientNameLabel")}
          </label>
          <input
            name="recipientName"
            required
            minLength={2}
            maxLength={100}
            className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-clay-700">
            {t("recipientPhoneLabel")}
          </label>
          <input
            name="recipientPhone"
            required
            minLength={8}
            maxLength={20}
            className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
          />
        </div>
        {deliveryMethod !== DeliveryMethod.HAND_DELIVERY && (
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("addressLabel")}</label>
            <input
              name="deliveryAddressText"
              maxLength={300}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
            />
          </div>
        )}

        <div className="rounded-xl2 border border-clay-100 p-4">
          <p className="mb-2 text-sm font-medium text-clay-700">{t("summaryTitle")}</p>
          <div className="flex justify-between text-sm text-clay-600">
            <span>{t("priceLabel")}</span>
            <span>{formatXaf(listing.priceXaf)}</span>
          </div>
          <div className="flex justify-between text-sm text-clay-600">
            <span>{t("deliveryFeeLabel")}</span>
            <span>{formatXaf(deliveryFeeXaf)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-clay-100 pt-2 font-semibold text-clay-900">
            <span>{t("totalLabel")}</span>
            <span>{formatXaf(totalXaf)}</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {t("confirm")}
        </button>
      </form>
    </div>
  );
}
