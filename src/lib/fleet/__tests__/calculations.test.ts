import { describe, it, expect } from "vitest";
import { fuelEfficiency, costPerKm, isMaintenanceDue, isLicenseExpiringSoon, tripDistance } from "../calculations";

describe("fuelEfficiency", () => {
  it("computes liters per 100km correctly", () => {
    expect(fuelEfficiency(10, 200)).toBe(5);
  });
  it("returns 0 when no distance was driven", () => {
    expect(fuelEfficiency(10, 0)).toBe(0);
  });
});

describe("costPerKm", () => {
  it("computes cost per km correctly", () => {
    expect(costPerKm(500, 100)).toBe(5);
  });
  it("returns 0 for zero distance", () => {
    expect(costPerKm(500, 0)).toBe(0);
  });
});

describe("isMaintenanceDue", () => {
  it("flags due by odometer threshold", () => {
    expect(isMaintenanceDue(10500, 10000, null)).toBe(true);
  });
  it("flags due by date threshold", () => {
    const today = new Date("2026-07-11");
    expect(isMaintenanceDue(1000, null, new Date("2026-07-01"), today)).toBe(true);
  });
  it("returns false when neither threshold is met", () => {
    const today = new Date("2026-07-11");
    expect(isMaintenanceDue(1000, 5000, new Date("2026-08-01"), today)).toBe(false);
  });
});

describe("isLicenseExpiringSoon", () => {
  it("flags a license expiring within the warning window", () => {
    const today = new Date("2026-07-11");
    expect(isLicenseExpiringSoon(new Date("2026-07-20"), today, 30)).toBe(true);
  });
  it("does not flag a license expiring far in the future", () => {
    const today = new Date("2026-07-11");
    expect(isLicenseExpiringSoon(new Date("2027-01-01"), today, 30)).toBe(false);
  });
  it("returns false when no expiry date is set", () => {
    expect(isLicenseExpiringSoon(null)).toBe(false);
  });
});

describe("tripDistance", () => {
  it("computes distance between start and end odometer", () => {
    expect(tripDistance(1000, 1250)).toBe(250);
  });
  it("returns 0 when trip is not yet completed", () => {
    expect(tripDistance(1000, null)).toBe(0);
  });
  it("returns 0 for an invalid (negative) reading", () => {
    expect(tripDistance(1000, 900)).toBe(0);
  });
});
