import { describe, it, expect } from "vitest";
import { buildDuplicateCheckHash, similarityScore } from "../duplicate-detection";

describe("buildDuplicateCheckHash", () => {
  it("produces the same hash for identical data", () => {
    const a = buildDuplicateCheckHash({ firstName: "أحمد", lastName: "علي", dateOfBirth: "1990-01-01", nationalId: "12345" });
    const b = buildDuplicateCheckHash({ firstName: "أحمد", lastName: "علي", dateOfBirth: "1990-01-01", nationalId: "12345" });
    expect(a).toBe(b);
  });

  it("normalizes Arabic diacritics and alef variants", () => {
    const a = buildDuplicateCheckHash({ firstName: "أحمد", lastName: "علي", dateOfBirth: "1990-01-01", nationalId: "12345" });
    const b = buildDuplicateCheckHash({ firstName: "احمد", lastName: "علي", dateOfBirth: "1990-01-01", nationalId: "12345" });
    expect(a).toBe(b);
  });

  it("is case-insensitive for latin input", () => {
    const a = buildDuplicateCheckHash({ firstName: "Ahmad", lastName: "Ali", nationalId: "999" });
    const b = buildDuplicateCheckHash({ firstName: "ahmad", lastName: "ali", nationalId: "999" });
    expect(a).toBe(b);
  });

  it("produces different hashes for different people", () => {
    const a = buildDuplicateCheckHash({ firstName: "أحمد", lastName: "علي", nationalId: "111" });
    const b = buildDuplicateCheckHash({ firstName: "محمد", lastName: "حسن", nationalId: "222" });
    expect(a).not.toBe(b);
  });

  it("handles missing optional fields without throwing", () => {
    expect(() => buildDuplicateCheckHash({ firstName: "سارة", lastName: "خالد" })).not.toThrow();
  });
});

describe("similarityScore", () => {
  it("returns 100 for identical normalized strings", () => {
    expect(similarityScore("أحمد علي", "احمد علي")).toBe(100);
  });

  it("returns 0 for empty input", () => {
    expect(similarityScore("", "test")).toBe(0);
  });

  it("returns a partial score for overlapping substrings", () => {
    const score = similarityScore("محمد", "محمد الأحمد");
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("returns a low score for unrelated strings", () => {
    const score = similarityScore("زيد", "قاسم");
    expect(score).toBeLessThan(50);
  });
});
