import { describe, expect, it } from "vitest";
import { hmToIso, isoToHM } from "@/lib/duration";

describe("hmToIso", () => {
  it("returns undefined when both are zero/blank", () => {
    expect(hmToIso(0, 0)).toBeUndefined();
    expect(hmToIso(NaN, NaN)).toBeUndefined();
  });
  it("formats minutes-only and hours-only", () => {
    expect(hmToIso(0, 35)).toBe("PT35M");
    expect(hmToIso(6, 0)).toBe("PT6H");
  });
  it("formats hours + minutes", () => {
    expect(hmToIso(1, 30)).toBe("PT1H30M");
  });
  it("normalizes overflow minutes", () => {
    expect(hmToIso(0, 90)).toBe("PT1H30M");
  });
  it("clamps negatives to zero", () => {
    expect(hmToIso(-3, -5)).toBeUndefined();
  });
});

describe("isoToHM", () => {
  it("parses minutes and hours", () => {
    expect(isoToHM("PT35M")).toEqual({ h: 0, m: 35 });
    expect(isoToHM("PT6H")).toEqual({ h: 6, m: 0 });
    expect(isoToHM("PT1H30M")).toEqual({ h: 1, m: 30 });
  });
  it("folds days/weeks into hours", () => {
    expect(isoToHM("P1D")).toEqual({ h: 24, m: 0 });
    expect(isoToHM("P1DT2H")).toEqual({ h: 26, m: 0 });
  });
  it("returns zero for empty/invalid", () => {
    expect(isoToHM(undefined)).toEqual({ h: 0, m: 0 });
    expect(isoToHM("")).toEqual({ h: 0, m: 0 });
  });
  it("round-trips through hmToIso", () => {
    for (const iso of ["PT35M", "PT6H", "PT1H30M"]) {
      const { h, m } = isoToHM(iso);
      expect(hmToIso(h, m)).toBe(iso);
    }
  });
});
