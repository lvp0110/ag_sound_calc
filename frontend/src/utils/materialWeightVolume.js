import { effectiveKpQuantity } from "./materialPackUnits";
import { getPriceWeight, getPriceVolume } from "../services/priceApi";

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
 * «Вес упаковки, кг: 0.38». «неопределен» и описания без «вес» → null.
 */
export function parsePriceWeightKg(raw) {
  const s = String(raw ?? "").trim();
  if (!s || /неопредел/i.test(s)) return null;
  if (!/вес/i.test(s)) return null;

  // `\b` после кириллицы в JS не работает (кириллица = non-word).
  const withTolerance = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:\+\/-\s*\d+(?:[.,]\d+)?\s*)?(?:кг|kg)(?=$|[\s/.,;:]|\/)/i,
  );
  if (withTolerance) return parseLocaleNumber(withTolerance[1]);

  const labeledKg = s.match(/кг\s*:\s*(\d+(?:[.,]\d+)?)/i);
  if (labeledKg) return parseLocaleNumber(labeledKg[1]);

  const grams = s.match(/(\d+(?:[.,]\d+)?)\s*(?:г(?:р)?\.?|g)(?=$|[\s/.,;:])/i);
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

  const withUnit = s.match(/(\d+(?:[.,]\d+)?)\s*(?:м\s*³|м3|m3)(?=$|[\s/.,;:])/i);
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

function addArticleQty(totals, article, qty) {
  const code = article != null ? String(article).trim() : "";
  if (!code || !Number.isFinite(qty) || qty <= 0) return;

  const weightKg = parsePriceWeightKg(getPriceWeight(code));
  if (weightKg != null) {
    totals.weightKg += weightKg * qty;
    totals.hasWeight = true;
  }

  const volumeM3 = parsePriceVolumeM3(getPriceVolume(code));
  if (volumeM3 != null) {
    totals.volumeM3 += volumeM3 * qty;
    totals.hasVolume = true;
  }
}

/**
 * Суммарный вес (кг) и объём (м³) материалов КП:
 * состав конструкций + доп. материалы с артикулом из прайса.
 */
export function computeKpMaterialsWeightVolumeTotals({
  materialsByConstruction,
  materialRowsByKeyId,
} = {}) {
  const totals = {
    weightKg: 0,
    volumeM3: 0,
    hasWeight: false,
    hasVolume: false,
  };

  if (Array.isArray(materialsByConstruction)) {
    for (const entry of materialsByConstruction) {
      const data = entry?.data;
      if (!Array.isArray(data)) continue;
      for (const material of data) {
        if (!material || typeof material !== "object") continue;
        const code = material.Code ?? material.code;
        const qty = effectiveKpQuantity(material, { forKp: true });
        addArticleQty(totals, code, qty);
      }
    }
  }

  if (materialRowsByKeyId && typeof materialRowsByKeyId === "object") {
    for (const rows of Object.values(materialRowsByKeyId)) {
      if (!Array.isArray(rows)) continue;
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const article = row.sourceArticle ?? row.article ?? row.Code;
        const qty = parseKpDecimal(row.quantity);
        addArticleQty(totals, article, qty);
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
