import { describe, expect, it } from "vitest";
import {
  formatVolumeM3,
  formatWeightKg,
  parsePriceVolumeM3,
  parsePriceWeightKg,
  computeKpMaterialsWeightVolumeTotals,
} from "./materialWeightVolume";

describe("parsePriceWeightKg", () => {
  it("parses prod plain numeric strings", () => {
    expect(parsePriceWeightKg("36,000")).toBeCloseTo(36);
    expect(parsePriceWeightKg("0,150")).toBeCloseTo(0.15);
    expect(parsePriceWeightKg("19,500")).toBeCloseTo(19.5);
    expect(parsePriceWeightKg("2,000")).toBeCloseTo(2);
  });

  it("parses common catalog text strings", () => {
    expect(parsePriceWeightKg("Вес листа - 35,6 кг")).toBeCloseTo(35.6);
    expect(parsePriceWeightKg("Вес: 2,15 кг/шт")).toBeCloseTo(2.15);
    expect(parsePriceWeightKg("Вес упаковки, кг: 0.38")).toBeCloseTo(0.38);
    expect(parsePriceWeightKg("Вес опоры: 230 гр;")).toBeCloseTo(0.23);
    expect(parsePriceWeightKg("Вес упаковки: 8,5 +/- 0,5 кг")).toBeCloseTo(8.5);
    expect(parsePriceWeightKg("Вес упаковки: 4,5 ± 0,3 кг")).toBeCloseTo(4.5);
  });

  it("returns null for unknown or non-weight text", () => {
    expect(parsePriceWeightKg("неопределен")).toBeNull();
    expect(
      parsePriceWeightKg(
        "Выпускается в виде готовой смеси в вёдрах по 3, 8 и 15 кг",
      ),
    ).toBeNull();
    expect(parsePriceWeightKg("")).toBeNull();
  });
});

describe("parsePriceVolumeM3", () => {
  it("parses prod plain numeric strings", () => {
    expect(parsePriceVolumeM3("0,144")).toBeCloseTo(0.144);
    expect(parsePriceVolumeM3("0,002")).toBeCloseTo(0.002);
    expect(parsePriceVolumeM3("0,360")).toBeCloseTo(0.36);
  });

  it("parses volume text strings", () => {
    expect(parsePriceVolumeM3("Объем упаковки: 0,144 м3")).toBeCloseTo(0.144);
    expect(parsePriceVolumeM3("Объем: 0,2 м3")).toBeCloseTo(0.2);
    expect(parsePriceVolumeM3("Объем упаковки: 0,36м3.")).toBeCloseTo(0.36);
  });

  it("ignores load capacity and undefined", () => {
    expect(parsePriceVolumeM3("Максимальная нагрузка: 15 кг")).toBeNull();
    expect(parsePriceVolumeM3("неопределен")).toBeNull();
    expect(parsePriceVolumeM3(" неопределен")).toBeNull();
  });
});

describe("computeKpMaterialsWeightVolumeTotals", () => {
  it("sums weight and volume from prod-style priceList", () => {
    const totals = computeKpMaterialsWeightVolumeTotals({
      materialsByConstruction: [
        {
          key_id: 1,
          data: [
            { Code: "1088665", Quantity: 2, Units: "шт" },
            { Code: "1222.2202", Quantity: 4, Units: "уп" },
          ],
        },
      ],
      priceList: [
        { article: "1088665", weight: "36,000", volume: "неопределен" },
        {
          article: "1222.2202",
          weight: "4,500",
          volume: "0,150",
        },
      ],
    });
    expect(totals.weightKg).toBeCloseTo(2 * 36 + 4 * 4.5);
    expect(totals.volumeM3).toBeCloseTo(4 * 0.15);
  });

  it("sums weight and volume from text priceList", () => {
    const totals = computeKpMaterialsWeightVolumeTotals({
      materialsByConstruction: [
        {
          key_id: 1,
          data: [
            { Code: "1088665", Quantity: 2, Units: "шт" },
            { Code: "1222.2202", Quantity: 4, Units: "уп" },
          ],
        },
      ],
      priceList: [
        { article: "1088665", weight: "Вес листа - 35,6 кг", volume: "неопределен" },
        {
          article: "1222.2202",
          weight: "Вес упаковки: 4,5 ± 0,3 кг",
          volume: "Объем упаковки: 0,15м3.",
        },
      ],
    });
    expect(totals.weightKg).toBeCloseTo(2 * 35.6 + 4 * 4.5);
    expect(totals.volumeM3).toBeCloseTo(4 * 0.15);
  });

  it("uses ceil of total area / 30 for 1407.4100, not per-card qty", () => {
    const totals = computeKpMaterialsWeightVolumeTotals({
      materialsByConstruction: [
        {
          key_id: "a",
          areaM2: 12,
          data: [{ Code: "1407.4100", Quantity: 1, Units: "шт" }],
        },
        {
          key_id: "b",
          areaM2: 12,
          data: [{ Code: "1407.4100", Quantity: 1, Units: "шт" }],
        },
      ],
      priceList: [{ article: "1407.4100", weight: "5,000", volume: "0,010" }],
    });
    expect(totals.weightKg).toBeCloseTo(1 * 5);
    expect(totals.volumeM3).toBeCloseTo(1 * 0.01);
  });
});

describe("formatters", () => {
  it("formats with units", () => {
    expect(formatWeightKg(12.5)).toMatch(/12,50 кг/);
    expect(formatVolumeM3(0.144)).toMatch(/0,144 м³/);
  });
});
