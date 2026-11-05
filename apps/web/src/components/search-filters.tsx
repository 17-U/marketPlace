"use client";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { CategoryDto, CityDto } from "@marketplace/shared";

interface SearchFiltersProps {
  categories: CategoryDto[];
  cities: CityDto[];
  initial: {
    q?: string;
    categoryId?: string;
    cityId?: string;
    sort?: string;
  };
}

export function SearchFilters({ categories, cities, initial }: SearchFiltersProps) {
  const t = useTranslations("search");
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const key of ["q", "categoryId", "cityId", "sort"]) {
      const value = formData.get(key);
      if (value && value !== "") params.set(key, String(value));
    }

    router.push(`/recherche${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
      <input
        type="text"
        name="q"
        defaultValue={initial.q}
        placeholder={t("placeholder")}
        className="min-w-[200px] flex-1 rounded-md border border-clay-100 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
      />
      <select
        name="categoryId"
        defaultValue={initial.categoryId ?? ""}
        className="rounded-md border border-clay-100 px-3 py-2 text-sm"
      >
        <option value="">{t("allCategories")}</option>
        {categories.map((category) => (
          <option key={category.id} value={category.id}>
            {category.icon} {category.nameFr}
          </option>
        ))}
      </select>
      <select
        name="cityId"
        defaultValue={initial.cityId ?? ""}
        className="rounded-md border border-clay-100 px-3 py-2 text-sm"
      >
        <option value="">{t("allCities")}</option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.nameFr}
          </option>
        ))}
      </select>
      <select
        name="sort"
        defaultValue={initial.sort ?? "recent"}
        className="rounded-md border border-clay-100 px-3 py-2 text-sm"
      >
        <option value="recent">{t("sortRecent")}</option>
        <option value="price_asc">{t("sortPriceAsc")}</option>
        <option value="price_desc">{t("sortPriceDesc")}</option>
      </select>
      <button
        type="submit"
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        {t("title")}
      </button>
    </form>
  );
}
