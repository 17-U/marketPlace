"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SUPPORTED_LOCALES, type Locale } from "@marketplace/shared";

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <select
      aria-label="Langue"
      className="rounded-md border border-clay-100 bg-white px-2 py-1 text-sm text-clay-700"
      value={locale}
      onChange={(event) => {
        router.replace(pathname, { locale: event.target.value as Locale });
      }}
    >
      {SUPPORTED_LOCALES.map((loc) => (
        <option key={loc} value={loc}>
          {loc.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
