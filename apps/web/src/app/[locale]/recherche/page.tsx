import { getTranslations } from "next-intl/server";
import { categoriesApi, citiesApi, listingsApi } from "@/lib/api-client";
import { ListingCard } from "@/components/listing-card";
import { SearchFilters } from "@/components/search-filters";
import { Link } from "@/i18n/navigation";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    categoryId?: string;
    cityId?: string;
    sort?: "recent" | "price_asc" | "price_desc";
    cursor?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const t = await getTranslations("search");

  const [categories, cities, results] = await Promise.all([
    categoriesApi.findAll(),
    citiesApi.findAll(),
    listingsApi.search(params),
  ]);

  const nextParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) nextParams.set(key, value);
  }
  if (results.nextCursor) nextParams.set("cursor", results.nextCursor);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="mb-4 text-xl font-bold text-clay-900">{t("title")}</h1>
      <SearchFilters categories={categories} cities={cities} initial={params} />

      {results.items.length === 0 ? (
        <p className="mt-10 text-center text-clay-500">{t("noResults")}</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {results.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {results.nextCursor && (
        <div className="mt-6 text-center">
          <Link
            href={`/recherche?${nextParams.toString()}`}
            className="inline-block rounded-full border border-brand-300 px-6 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            {t("loadMore")}
          </Link>
        </div>
      )}
    </div>
  );
}
