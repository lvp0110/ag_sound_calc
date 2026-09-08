import { describe, expect, it } from "vitest";
import {
  formatVolumeM3,
  formatWeightKg,
  parsePriceVolumeM3,
  parsePriceWeightKg,
  computeKpMaterialsWeightVolumeTotals,
} from "./materialWeightVolume";

describe("parsePriceWeightKg", () => {
  it("parses common catalog strings", () => {
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
  it("parses volume strings", () => {
    expect(parsePriceVolumeM3("Объем упаковки: 0,144 м3")).toBeCloseTo(0.144);
    expect(parsePriceVolumeM3("Объем: 0,2 м3")).toBeCloseTo(0.2);
    expect(parsePriceVolumeM3("Объем упаковки: 0,36м3.")).toBeCloseTo(0.36);
  });

  it("ignores load capacity and undefined", () => {
    expect(parsePriceVolumeM3("Максимальная нагрузка: 15 кг")).toBeNull();
    expect(parsePriceVolumeM3("неопределен")).toBeNull();
  });
});

describe("computeKpMaterialsWeightVolumeTotals", () => {
  it("sums weight and volume from priceList by article", () => {
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
});

describe("formatters", () => {
  it("formats with units", () => {
    expect(formatWeightKg(12.5)).toMatch(/12,50 кг/);
    expect(formatVolumeM3(0.144)).toMatch(/0,144 м³/);
  });
});
