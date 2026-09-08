import { effectiveKpQuantity } from "./materialPackUnits";

function parseLocaleNumber(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Вес из строки прайса → кг.
 * Примеры: «Вес листа - 35,6 кг», «Вес: 2,15 кг/шт», «Вес опоры: 230 гр»,
 * «Вес упаковки: 4,5 ± 0,3 кг», «Вес упаковки, кг: 0.38».
 */
export function parsePriceWeightKg(raw) {
  const s = String(raw ?? "").trim();
  if (!s || /неопредел/i.test(s)) return null;
  if (!/вес/i.test(s)) return null;

  // Берём первое число перед кг/kg; допуск «± / +/-» не должен съедать значение.
  const beforeKg = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:(?:\+|±)\s*\/?\s*-?\s*\d+(?:[.,]\d+)?\s*)?(?:кг|kg)(?=$|[\s/.,;:]|\/)/i,
  );
  if (beforeKg) return parseLocaleNumber(beforeKg[1]);

  const labeledKg = s.match(/кг\s*:\s*(\d+(?:[.,]\d+)?)/i);
  if (labeledKg) return parseLocaleNumber(labeledKg[1]);

  const grams = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:г(?:р)?\.?|g)(?=$|[\s/.,;:])/i,
  );
  if (grams) {
    const g = parseLocaleNumber(grams[1]);
    return g == null ? null : g / 1000;
  }

  return null;
}

/**
 * Объём из строки прайса → м³.
 * Учитывает только явный объём («Объем упаковки: 0,144 м3»).
 * Поля вроде «Максимальная нагрузка: … кг» в колонке volume игнорируются.
 */
export function parsePriceVolumeM3(raw) {
  const s = String(raw ?? "").trim();
  if (!s || /неопредел/i.test(s)) return null;
  if (!/объем|объём/i.test(s) && !/м\s*³|м3|m3/i.test(s)) return null;
  if (/нагрузк/i.test(s)) return null;

  const withUnit = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:м\s*³|м3|m3)(?=$|[\s/.,;:])/i,
  );
  if (withUnit) return parseLocaleNumber(withUnit[1]);

  const labeled = s.match(/(?:объем|объём)[^0-9]*(\d+(?:[.,]\d+)?)/i);
  if (labeled) return parseLocaleNumber(labeled[1]);

  return null;
}

function parseKpDecimal(raw) {
  if (raw == null) return null;
  const s = String(raw).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function materialArticleCodes(material) {
  const raw = [
    material?.Code,
    material?.code,
    material?.articul,
    material?.Articul,
    material?.article,
    material?.sourceArticle,
  ];
  const out = [];
  for (const value of raw) {
    if (value == null || value === "") continue;
    const code = String(value).trim();
    if (!code || out.includes(code)) continue;
    out.push(code);
  }
  return out;
}

/** Map артикул → { weight, volume } из списка прайса (и запасной lookup-функции). */
export function buildPriceWeightVolumeIndex(priceList, fallbackLookup) {
  const byArticle = new Map();

  const put = (article, weight, volume) => {
    const key = article != null ? String(article).trim() : "";
    if (!key) return;
    const row = { weight: weight ?? "", volume: volume ?? "" };
    byArticle.set(key, row);
    byArticle.set(key.toLowerCase(), row);
  };

  if (Array.isArray(priceList)) {
    for (const row of priceList) {
      if (!row || typeof row !== "object") continue;
      put(row.article ?? row.code, row.weight, row.volume);
    }
  }

  return {
    get(article) {
      const key = article != null ? String(article).trim() : "";
      if (!key) return { weight: "", volume: "" };
      const hit = byArticle.get(key) || byArticle.get(key.toLowerCase());
      if (hit) return hit;
      if (typeof fallbackLookup === "function") {
        return fallbackLookup(key);
      }
      return { weight: "", volume: "" };
    },
  };
}

function addArticleQty(totals, index, article, qty) {
  const code = article != null ? String(article).trim() : "";
  if (!code || !Number.isFinite(qty) || qty <= 0) return;

  const { weight, volume } = index.get(code);

  const weightKg = parsePriceWeightKg(weight);
  if (weightKg != null) {
    totals.weightKg += weightKg * qty;
    totals.hasWeight = true;
  }

  const volumeM3 = parsePriceVolumeM3(volume);
  if (volumeM3 != null) {
    totals.volumeM3 += volumeM3 * qty;
    totals.hasVolume = true;
  }
}

/**
 * Суммарный вес (кг) и объём (м³) материалов КП.
 * `priceList` — актуальный список из usePriceData().list (не читать кэш побочно).
 */
export function computeKpMaterialsWeightVolumeTotals({
  materialsByConstruction,
  materialRowsByKeyId,
  priceList,
  fallbackLookup,
} = {}) {
  const totals = {
    weightKg: 0,
    volumeM3: 0,
    hasWeight: false,
    hasVolume: false,
  };

  const index = buildPriceWeightVolumeIndex(priceList, fallbackLookup);

  if (Array.isArray(materialsByConstruction)) {
    for (const entry of materialsByConstruction) {
      const data = entry?.data;
      if (!Array.isArray(data)) continue;
      for (const material of data) {
        if (!material || typeof material !== "object") continue;
        const qty = effectiveKpQuantity(material, { forKp: true });
        for (const code of materialArticleCodes(material)) {
          addArticleQty(totals, index, code, qty);
          // Один артикул на позицию достаточно (Code / articul — обычно одно и то же).
          break;
        }
      }
    }
  }

  if (materialRowsByKeyId && typeof materialRowsByKeyId === "object") {
    for (const rows of Object.values(materialRowsByKeyId)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const qty = parseKpDecimal(row.quantity);
        for (const code of materialArticleCodes(row)) {
          addArticleQty(totals, index, code, qty);
          break;
        }
      }
    }
  }

  return totals;
}

export function formatWeightKg(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} кг`;
}

export function formatVolumeM3(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return `${Number(value).toLocaleString("ru-RU", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })} м³`;
}
