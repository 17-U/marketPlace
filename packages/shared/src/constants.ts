import { DeliveryMethod } from "./enums";

export const MAX_LISTING_PHOTOS = 8;

// Numéros camerounais: +237 suivi de 9 chiffres commençant par 6 (mobile).
export const CAMEROON_PHONE_REGEX = /^\+237[26]\d{8}$/;

export const DEFAULT_LOCALE = "fr" as const;
export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const CAMEROON_CITIES: Array<{ nameFr: string; nameEn: string; region: string }> = [
  { nameFr: "Yaoundé", nameEn: "Yaounde", region: "Centre" },
  { nameFr: "Douala", nameEn: "Douala", region: "Littoral" },
  { nameFr: "Bafoussam", nameEn: "Bafoussam", region: "Ouest" },
  { nameFr: "Garoua", nameEn: "Garoua", region: "Nord" },
  { nameFr: "Bamenda", nameEn: "Bamenda", region: "Nord-Ouest" },
  { nameFr: "Maroua", nameEn: "Maroua", region: "Extrême-Nord" },
  { nameFr: "Ngaoundéré", nameEn: "Ngaoundere", region: "Adamaoua" },
  { nameFr: "Bertoua", nameEn: "Bertoua", region: "Est" },
  { nameFr: "Buea", nameEn: "Buea", region: "Sud-Ouest" },
  { nameFr: "Ebolowa", nameEn: "Ebolowa", region: "Sud" },
  { nameFr: "Kribi", nameEn: "Kribi", region: "Sud" },
  { nameFr: "Limbe", nameEn: "Limbe", region: "Sud-Ouest" },
];

export const DEFAULT_CATEGORIES: Array<{
  slug: string;
  nameFr: string;
  nameEn: string;
  icon: string;
}> = [
  { slug: "vetements-femme", nameFr: "Vêtements femme", nameEn: "Women's clothing", icon: "👗" },
  { slug: "vetements-homme", nameFr: "Vêtements homme", nameEn: "Men's clothing", icon: "👔" },
  { slug: "vetements-enfant", nameFr: "Vêtements enfant", nameEn: "Kids' clothing", icon: "🧒" },
  { slug: "chaussures", nameFr: "Chaussures", nameEn: "Shoes", icon: "👟" },
  { slug: "wax-pagne", nameFr: "Wax & pagne", nameEn: "Wax & fabric", icon: "🧵" },
  { slug: "sacs-accessoires", nameFr: "Sacs & accessoires", nameEn: "Bags & accessories", icon: "👜" },
  { slug: "bijoux", nameFr: "Bijoux", nameEn: "Jewelry", icon: "💍" },
  { slug: "electronique", nameFr: "Électronique", nameEn: "Electronics", icon: "📱" },
  { slug: "maison", nameFr: "Maison & déco", nameEn: "Home & decor", icon: "🏠" },
  { slug: "beaute", nameFr: "Beauté & soins", nameEn: "Beauty & care", icon: "💄" },
];

export const DEFAULT_PLATFORM_COMMISSION_PERCENT = 8;
export const DEFAULT_ORDER_AUTO_RELEASE_DAYS = 3;
export const DEFAULT_PAGE_SIZE = 20;

// Frais de livraison forfaitaires en XAF selon le mode choisi à la commande.
export const DELIVERY_FEES_XAF: Record<DeliveryMethod, number> = {
  [DeliveryMethod.HAND_DELIVERY]: 0,
  [DeliveryMethod.LOCAL_COURIER]: 1500,
  [DeliveryMethod.TRAVEL_AGENCY]: 3000,
};
