import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listingsApi } from "@/lib/api-client";
import { ListingCard } from "@/components/listing-card";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const results = await listingsApi.search({ sort: "recent", limit: 8 });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <section className="rounded-xl2 bg-gradient-to-br from-brand-100 to-brand-50 px-6 py-12 text-center sm:py-16">
        <h1 className="text-2xl font-bold text-clay-900 sm:text-4xl">{t("heroTitle")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-clay-700">{t("heroSubtitle")}</p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/vendre"
            className="w-full rounded-full bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700 sm:w-auto"
          >
            {t("ctaSell")}
          </Link>
          <Link
            href="/recherche"
            className="w-full rounded-full border border-brand-300 px-6 py-3 font-medium text-brand-700 hover:bg-brand-50 sm:w-auto"
          >
            {t("ctaBrowse")}
          </Link>
        </div>
      </section>

      <h2 className="mt-10 mb-4 text-lg font-bold text-clay-900">{t("recentTitle")}</h2>

      {results.items.length === 0 ? (
        <p className="text-center text-sm text-clay-500">{t("comingSoon")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {results.items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
