"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { OrderSummaryDto } from "@marketplace/shared";
import { useRouter } from "@/i18n/navigation";
import { ordersApi } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";
import { OrderList } from "@/components/order-list";

export default function MyPurchasesPage() {
  const t = useTranslations("orders");
  const router = useRouter();
  const [orders, setOrders] = useState<OrderSummaryDto[] | null>(null);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    ordersApi
      .findMineAsBuyer(tokens.accessToken)
      .then(setOrders)
      .catch(() => setOrders([]));
  }, [router]);

  if (orders === null) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("buyingTitle")}</h1>
      <OrderList orders={orders} emptyLabel={t("empty")} />
    </div>
  );
}
