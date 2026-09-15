import { describe, expect, it } from "vitest";
import {
  aggregatePackMaterialAcrossConstructions,
  formatMaterialQuantity,
} from "./materialPackUnits";

describe("aggregatePackMaterialAcrossConstructions", () => {
  it("uses total area and calc m2PerPack, not summed ceiled pieces", () => {
    const line = aggregatePackMaterialAcrossConstructions(
      [
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
      "1407.4100",
    );
    expect(line.areaSumM2).toBeCloseTo(24);
    expect(line.piecesSum).toBeCloseTo(0.8);
    expect(line.packQty).toBe(1);
  });

  it("ignores constructions without the article", () => {
    const line = aggregatePackMaterialAcrossConstructions(
      [
        {
          key_id: "a",
          areaM2: 12,
          data: [{ Code: "1407.4100", Quantity: 1 }],
        },
        {
          key_id: "b",
          areaM2: 100,
          data: [{ Code: "1088665", Quantity: 2 }],
        },
      ],
      "1407.4100",
    );
    expect(line.areaSumM2).toBeCloseTo(12);
    expect(line.packQty).toBe(1);
  });

  it("returns null when the article is not used", () => {
    expect(
      aggregatePackMaterialAcrossConstructions(
        [{ data: [{ Code: "1408.0201", Quantity: 10 }], areaM2: 12 }],
        "1407.4100",
      ),
    ).toBeNull();
  });
});

describe("formatMaterialQuantity for 1407.4100", () => {
  it("shows unrounded area / 30 in the construction card", () => {
    const material = { Code: "1407.4100", Quantity: 1, Units: "шт" };
    expect(
      formatMaterialQuantity(material, { forKp: true, areaM2: 12 }),
    ).toBe("0.4");
    expect(
      formatMaterialQuantity(material, { forKp: false, areaM2: 12 }),
    ).toBe("0.4");
  });

  it("shows packed qty only on the aggregated KP line", () => {
    const material = {
      Code: "1407.4100",
      Quantity: 0.8,
      KpQuantity: 1,
      Units: "шт",
      __kpAggregatedPackLine: true,
    };
    expect(formatMaterialQuantity(material, { forKp: true })).toBe("1");
  });
});
