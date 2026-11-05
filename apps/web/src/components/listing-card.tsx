import Image from "next/image";
import { ListingSummaryDto } from "@marketplace/shared";
import { Link } from "@/i18n/navigation";
import { formatXaf } from "@/lib/format";
import { conditionLabel } from "@/lib/labels";

export function ListingCard({
  listing,
  locale = "fr",
}: {
  listing: ListingSummaryDto;
  locale?: string;
}) {
  return (
    <Link
      href={`/annonces/${listing.id}`}
      className="group block overflow-hidden rounded-xl2 border border-clay-100 bg-white transition hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-clay-100">
        {listing.coverPhotoUrl ? (
          <Image
            src={listing.coverPhotoUrl}
            alt={listing.title}
            fill
            sizes="(max-width: 640px) 50vw, 25vw"
            className="object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">📦</div>
        )}
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-clay-900">{listing.title}</p>
        <p className="mt-1 font-semibold text-brand-700">{formatXaf(listing.priceXaf)}</p>
        <p className="mt-1 truncate text-xs text-clay-500">
          {conditionLabel(listing.condition, locale)} · {listing.cityNameFr}
        </p>
      </div>
    </Link>
  );
}
