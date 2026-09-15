import { describe, expect, it } from "vitest";
import {
  CALC_FALLBACK_2GKL,
  CALC_FALLBACK_S2,
  CALC_FALLBACK_TAPE,
  applyCalcFallbackMaps,
  calcFallbackAttempts,
} from "./calcUlTapeFallback.js";

describe("calcFallbackAttempts", () => {
  it("keeps native *_s2 before peeling wool for L404 combined suffixes", () => {
    const attempts = calcFallbackAttempts("AG.L404_ul_s2_2gkl_ul_tape");
    const nativeS2 = attempts.findIndex(
      (a) =>
        a.code === "AG.L404_ul_s2" &&
        a.maps.includes(CALC_FALLBACK_2GKL) &&
        a.maps.includes(CALC_FALLBACK_TAPE),
    );
    const peeledWool = attempts.findIndex((a) =>
      a.maps.includes(CALC_FALLBACK_S2),
    );
    expect(nativeS2).toBeGreaterThanOrEqual(0);
    expect(peeledWool).toBeGreaterThan(nativeS2);
  });

  it("tries tape fallback to AG.L404_ul_s2 without substituting ЭКО", () => {
    const attempts = calcFallbackAttempts("AG.L404_ul_s2_ul_tape");
    expect(attempts.some((a) => a.code === "AG.L404_ul_s2")).toBe(true);
    const firstS2Peel = attempts.findIndex((a) =>
      a.maps.includes(CALC_FALLBACK_S2),
    );
    const firstNativeS2 = attempts.findIndex((a) => a.code === "AG.L404_ul_s2");
    expect(firstNativeS2).toBeGreaterThanOrEqual(0);
    expect(firstS2Peel).toBeGreaterThan(firstNativeS2);
  });
});

describe("applyCalcFallbackMaps", () => {
  it("maps vibrostek tape and 2gkl without changing S2 quantity", () => {
    const mapped = applyCalcFallbackMaps(
      [
        { Code: "1252.2204", Quantity: 1, Units: "уп" },
        { Code: "1211.1001", Quantity: 4, Units: "шт" },
        { Code: "1088665", Quantity: 2, Units: "шт" },
        { Code: "1185.1101", Quantity: 1, Units: "шт" },
      ],
      [CALC_FALLBACK_2GKL, CALC_FALLBACK_TAPE],
    );
    expect(mapped.find((r) => r.Code === "1252.2204").Quantity).toBe(1);
    expect(mapped.find((r) => r.Code === "1211.1001")).toBeUndefined();
    expect(mapped.find((r) => r.Code === "1088665").Quantity).toBe(4);
    expect(mapped.find((r) => r.Code === "1185.1101")).toBeUndefined();
    expect(mapped.find((r) => r.Code === "1405.2101").Quantity).toBe(1);
  });
});
