import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LanguageSwitcher } from "./language-switcher";

export async function Header() {
  const t = await getTranslations("nav");

  return (
    <header className="sticky top-0 z-10 border-b border-clay-100 bg-clay-50/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-brand-700">
          Marketplace
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/recherche" className="hidden text-clay-700 hover:text-brand-600 sm:inline">
            {t("search")}
          </Link>
          <Link href="/favoris" className="hidden text-clay-700 hover:text-brand-600 sm:inline">
            {t("favorites")}
          </Link>
          <Link href="/messages" className="hidden text-clay-700 hover:text-brand-600 sm:inline">
            {t("messages")}
          </Link>
          <Link href="/achats" className="hidden text-clay-700 hover:text-brand-600 md:inline">
            {t("buying")}
          </Link>
          <Link href="/ventes" className="hidden text-clay-700 hover:text-brand-600 md:inline">
            {t("selling")}
          </Link>
          <Link
            href="/vendre"
            className="hidden rounded-full border border-brand-300 px-4 py-2 font-medium text-brand-700 hover:bg-brand-50 sm:inline"
          >
            {t("sell")}
          </Link>
          <Link href="/notifications" aria-label={t("notifications")} className="text-clay-700 hover:text-brand-600">
            🔔
          </Link>
          <LanguageSwitcher />
          <Link
            href="/login"
            className="rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700"
          >
            {t("login")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
