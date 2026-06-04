/**
 * Порт frontend/src/constants/regionSelectOptions.js — slug города из Offer.region
 * → ключ региональных цен в прайсе (msk, ural, kazan, south).
 */

const REGION_KEY_ALIASES: Record<string, string> = {
  msk: "msk",
  moscow: "msk",
  москва: "msk",
  "санкт-петербург": "msk",
  "saint-petersburg": "msk",
  spb: "msk",
  спб: "msk",
  ural: "ural",
  урал: "ural",
  yekaterinburg: "ural",
  екатеринбург: "ural",
  ufa: "ural",
  уфа: "ural",
  south: "south",
  юг: "south",
  krasnodar: "south",
  краснодар: "south",
  kazan: "kazan",
  kasan: "kazan",
  казань: "kazan",
};

/** Значение offer.region (город или ключ) → ключ regionalPrices в /api/v2/data. */
export const resolvePriceRegionKey = (region: string | null | undefined): string => {
  const normalized = String(region ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return REGION_KEY_ALIASES[normalized] ?? normalized;
};
