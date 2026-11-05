"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CategoryDto, CityDto, ListingCondition, MAX_LISTING_PHOTOS } from "@marketplace/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { categoriesApi, citiesApi, listingsApi, ApiError } from "@/lib/api-client";
import { loadTokens } from "@/lib/auth-storage";

type Step = "info" | "photos" | "review";

interface PhotoPreview {
  id: string;
  previewUrl: string;
  thumbUrl: string | null;
}

export default function SellPage() {
  const t = useTranslations("sell");
  const router = useRouter();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [cities, setCities] = useState<CityDto[]>([]);
  const [step, setStep] = useState<Step>("info");
  const [listingId, setListingId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    const tokens = loadTokens();
    if (!tokens) {
      router.push("/login");
      return;
    }
    setAccessToken(tokens.accessToken);

    Promise.all([categoriesApi.findAll(), citiesApi.findAll()]).then(([cats, cts]) => {
      setCategories(cats);
      setCities(cts);
    });
  }, [router]);

  async function handleInfoSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    try {
      const listing = await listingsApi.create(accessToken, {
        title: formData.get("title"),
        description: formData.get("description"),
        categoryId: formData.get("categoryId"),
        condition: formData.get("condition"),
        brand: formData.get("brand") || undefined,
        size: formData.get("size") || undefined,
        priceXaf: Number(formData.get("priceXaf")),
        cityId: formData.get("cityId"),
        neighborhood: formData.get("neighborhood") || undefined,
      });
      setListingId(listing.id);
      setStep("photos");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loginRequired"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePhotoSelect(event: React.ChangeEvent<HTMLInputElement>) {
    if (!accessToken || !listingId) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    for (const file of files) {
      if (photos.length >= MAX_LISTING_PHOTOS) break;
      const previewUrl = URL.createObjectURL(file);
      try {
        const uploaded = await listingsApi.uploadPhoto(accessToken, listingId, file);
        setPhotos((prev) => [
          ...prev,
          { id: uploaded.id, previewUrl, thumbUrl: uploaded.thumbUrl },
        ]);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t("loginRequired"));
      }
    }
  }

  async function handleRemovePhoto(photoId: string) {
    if (!accessToken || !listingId) return;
    await listingsApi.deletePhoto(accessToken, listingId, photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  async function handlePublish() {
    if (!accessToken || !listingId) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await listingsApi.publish(accessToken, listingId);
      setPublished(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loginRequired"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!accessToken) return null;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="mb-1 text-xl font-bold text-clay-900">{t("title")}</h1>
      <p className="mb-6 text-sm text-clay-500">
        {step === "info" ? t("stepInfo") : step === "photos" ? t("stepPhotos") : t("stepReview")}
      </p>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {step === "info" && (
        <form onSubmit={handleInfoSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("titleLabel")}</label>
            <input
              name="title"
              required
              minLength={3}
              maxLength={100}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">
              {t("descriptionLabel")}
            </label>
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={3000}
              rows={4}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("categoryLabel")}</label>
            <select name="categoryId" required className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2">
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.nameFr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("conditionLabel")}</label>
            <select name="condition" required className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2">
              <option value={ListingCondition.NEW}>{t("conditionNew")}</option>
              <option value={ListingCondition.VERY_GOOD}>{t("conditionVeryGood")}</option>
              <option value={ListingCondition.GOOD}>{t("conditionGood")}</option>
              <option value={ListingCondition.FAIR}>{t("conditionFair")}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-clay-700">{t("brandLabel")}</label>
              <input name="brand" maxLength={60} className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-clay-700">{t("sizeLabel")}</label>
              <input name="size" maxLength={30} className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("priceLabel")}</label>
            <input
              name="priceXaf"
              type="number"
              required
              min={100}
              max={50000000}
              step={100}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">{t("cityLabel")}</label>
            <select name="cityId" required className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2">
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.nameFr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-clay-700">
              {t("neighborhoodLabel")}
            </label>
            <input
              name="neighborhood"
              maxLength={100}
              className="mt-1 w-full rounded-md border border-clay-100 px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {t("next")}
          </button>
        </form>
      )}

      {step === "photos" && (
        <div>
          <p className="mb-3 text-sm text-clay-600">{t("photosHint")}</p>
          <div className="mb-4 grid grid-cols-4 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-md bg-clay-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.thumbUrl ?? photo.previewUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => void handleRemovePhoto(photo.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < MAX_LISTING_PHOTOS && (
              <label className="flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-clay-200 text-xs text-clay-500">
                {t("addPhoto")}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(event) => void handlePhotoSelect(event)}
                />
              </label>
            )}
          </div>
          <button
            type="button"
            disabled={photos.length === 0}
            onClick={() => setStep("review")}
            className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {t("next")}
          </button>
        </div>
      )}

      {step === "review" && !published && (
        <div>
          <p className="mb-4 text-sm text-clay-600">{t("photosHint")}</p>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void handlePublish()}
            className="w-full rounded-full bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {t("publish")}
          </button>
        </div>
      )}

      {published && listingId && (
        <div className="text-center">
          <p className="mb-4 font-medium text-green-700">{t("publishSuccess")}</p>
          <Link
            href={`/annonces/${listingId}`}
            className="inline-block rounded-full bg-brand-600 px-6 py-2 font-medium text-white hover:bg-brand-700"
          >
            {t("viewListing")}
          </Link>
        </div>
      )}
    </div>
  );
}
