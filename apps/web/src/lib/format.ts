// Formate un montant entier en FCFA, ex: 15000 -> "15 000 FCFA".
export function formatXaf(amount: number, locale: "fr" | "en" = "fr"): string {
  const formatted = new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US").format(amount);
  // Intl insère des espaces insécables (U+00A0 ou U+202F) comme séparateur de
  // milliers : on les normalise en espace classique pour un rendu et des
  // comparaisons prévisibles.
  const normalized = formatted.replace(/[  ]/g, " ");
  return `${normalized} FCFA`;
}
