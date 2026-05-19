export const REGION_SELECT_OPTIONS = [
  { value: "moscow", label: "Москва", regionKey: "msk" },
  { value: "saint-petersburg", label: "Санкт-Петербург", regionKey: "msk" },
  { value: "yekaterinburg", label: "Екатеринбург", regionKey: "ural" },
  { value: "ufa", label: "Уфа", regionKey: "ural" },
  { value: "krasnodar", label: "Краснодар", regionKey: "south" },
  { value: "kazan", label: "Казань", regionKey: "kazan" },
];

/** Ключи прайса (msk, ural, …) и подписи из API → regionKey селекта. */
const REGION_KEY_ALIASES = {
  msk: "msk",
  moscow: "msk",
  москва: "msk",
  "санкт-петербург": "msk",
  "saint-petersburg": "msk",
  spb: "msk",
  "спб": "msk",
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

export function resolvePriceRegionKey(region) {
  const normalized = String(region ?? "").trim().toLowerCase();
  if (!normalized) return "";
  return REGION_KEY_ALIASES[normalized] ?? normalized;
}

export function filterVisibleRegionOptions(regions) {
  const availableKeys = new Set(
    (regions ?? []).map((region) => resolvePriceRegionKey(region)).filter(Boolean)
  );
  return REGION_SELECT_OPTIONS.filter((option) =>
    availableKeys.has(option.regionKey)
  );
}

/** Значение региона из оффера (slug города) → подпись как в селекте прайса. */
export function findRegionOptionByValue(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return REGION_SELECT_OPTIONS.find((o) => o.value === normalized);
}

export function findRegionOptionByRegionKey(regionKey) {
  const normalized = String(regionKey ?? "").trim().toLowerCase();
  if (!normalized) return undefined;
  return REGION_SELECT_OPTIONS.find((o) => o.regionKey === normalized);
}

export function getRegionCityLabel(region) {
  if (region == null || region === "") return "";
  const raw = String(region).trim();
  const normalized = raw.toLowerCase();
  const byValue = REGION_SELECT_OPTIONS.find((o) => o.value === normalized);
  if (byValue) return byValue.label;
  const byLabel = REGION_SELECT_OPTIONS.find((o) => o.label === raw);
  if (byLabel) return byLabel.label;
  const byKey = REGION_SELECT_OPTIONS.find((o) => o.regionKey === normalized);
  if (byKey) return byKey.label;
  return raw;
}
