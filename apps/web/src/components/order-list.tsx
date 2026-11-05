import Image from "next/image";
import { useTranslations } from "next-intl";
import { OrderSummaryDto } from "@marketplace/shared";
import { Link } from "@/i18n/navigation";
import { formatXaf } from "@/lib/format";
import { orderStatusKey } from "@/lib/labels";

const STATUS_COLORS: Record<string, string> = {
  CREATED: "bg-clay-100 text-clay-700",
  PAID_HELD: "bg-blue-100 text-blue-700",
  SHIPPED: "bg-amber-100 text-amber-700",
  DELIVERED: "bg-amber-100 text-amber-700",
  RELEASED: "bg-green-100 text-green-700",
  CANCELLED: "bg-clay-100 text-clay-500",
  DISPUTED: "bg-red-100 text-red-700",
  REFUNDED: "bg-red-100 text-red-700",
};

export function OrderList({ orders, emptyLabel }: { orders: OrderSummaryDto[]; emptyLabel: string }) {
  const t = useTranslations("orders");

  if (orders.length === 0) {
    return <p className="text-center text-clay-500">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-clay-100 rounded-xl2 border border-clay-100 bg-white">
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={`/commandes/${order.id}`} className="flex items-center gap-3 p-3 hover:bg-clay-50">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-clay-100">
              {order.listingCoverPhotoUrl ? (
                <Image
                  src={order.listingCoverPhotoUrl}
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xl">📦</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-clay-900">{order.listingTitle}</p>
              <p className="text-xs text-clay-500">{formatXaf(order.totalXaf)}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[order.status] ?? "bg-clay-100 text-clay-700"}`}
            >
              {t(orderStatusKey(order.status))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
