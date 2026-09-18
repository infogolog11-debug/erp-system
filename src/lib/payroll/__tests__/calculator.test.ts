import { describe, it, expect } from "vitest";
import { resolveContractAllowance, type AllowanceCatalogEntry } from "../calculator";

const catalog: AllowanceCatalogEntry[] = [
  { componentType: "allowance", code: "HOUSE", defaultValue: "200" },
  { componentType: "allowance", code: "TRANS", defaultValue: "50" },
  { componentType: "bonus",     code: "PERF",  defaultValue: "100" },
];

describe("resolveContractAllowance", () => {
  it("uses the contract-specific value when set, ignoring the catalog default", () => {
    expect(resolveContractAllowance("450", catalog, "HOUSE")).toBe(450);
  });

  it("falls back to the org catalog default when the contract has no override (null)", () => {
    expect(resolveContractAllowance(null, catalog, "HOUSE")).toBe(200);
  });

  it("falls back to the org catalog default when the contract has no override (undefined)", () => {
    expect(resolveContractAllowance(undefined, catalog, "TRANS")).toBe(50);
  });

  it("treats a contract value of 0 as an explicit override, not 'unset'", () => {
    // 0 is a legitimate per-employee override (e.g. remote worker with no transport allowance)
    // and must NOT silently fall back to the catalog default.
    expect(resolveContractAllowance(0, catalog, "HOUSE")).toBe(0);
    expect(resolveContractAllowance("0", catalog, "TRANS")).toBe(0);
  });

  it("returns 0 when there is no contract override and no matching catalog entry", () => {
    expect(resolveContractAllowance(null, [], "HOUSE")).toBe(0);
  });

  it("does not mix up HOUSE and TRANS codes", () => {
    expect(resolveContractAllowance(null, catalog, "TRANS")).not.toBe(200);
    expect(resolveContractAllowance(null, catalog, "HOUSE")).not.toBe(50);
  });
});
