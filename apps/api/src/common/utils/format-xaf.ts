// Formate un montant entier en FCFA pour les textes de notification, ex: 15000 -> "15 000 FCFA".
export function formatXaf(amountXaf: number): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(amountXaf);
  // \s couvre aussi les espaces insecables que Intl utilise comme separateur
  // de milliers: on les normalise en espace classique pour un texte previsible.
  const normalized = formatted.replace(/\s/g, " ");
  return `${normalized} FCFA`;
}
