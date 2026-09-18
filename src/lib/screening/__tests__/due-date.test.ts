import { describe, it, expect } from "vitest";
import { computeNextScreeningDue, isScreeningOverdue, screeningStatusLabel } from "../due-date";

describe("computeNextScreeningDue", () => {
  it("schedules annual re-screening for a clear result", () => {
    const due = computeNextScreeningDue(new Date("2026-01-01"), "clear");
    expect(due?.toISOString().slice(0,10)).toBe("2027-01-01");
  });

  it("schedules a 1-month follow-up for a potential match", () => {
    const due = computeNextScreeningDue(new Date("2026-01-01"), "potential_match");
    expect(due?.toISOString().slice(0,10)).toBe("2026-02-01");
  });

  it("returns null for a confirmed match (no further scheduling)", () => {
    expect(computeNextScreeningDue(new Date("2026-01-01"), "confirmed_match")).toBeNull();
  });
});

describe("isScreeningOverdue", () => {
  it("flags a past due date as overdue", () => {
    expect(isScreeningOverdue(new Date("2026-01-01"), new Date("2026-02-01"))).toBe(true);
  });
  it("does not flag a future due date", () => {
    expect(isScreeningOverdue(new Date("2026-06-01"), new Date("2026-02-01"))).toBe(false);
  });
  it("returns false when no due date is set", () => {
    expect(isScreeningOverdue(null)).toBe(false);
  });
});

describe("screeningStatusLabel", () => {
  it("labels an entity with no record as not_screened", () => {
    expect(screeningStatusLabel(false, null, false)).toBe("not_screened");
  });
  it("labels a confirmed match as blocked regardless of overdue state", () => {
    expect(screeningStatusLabel(true, "confirmed_match", false)).toBe("blocked");
  });
  it("labels a potential match as flagged", () => {
    expect(screeningStatusLabel(true, "potential_match", false)).toBe("flagged");
  });
  it("labels an overdue clear screening as overdue", () => {
    expect(screeningStatusLabel(true, "clear", true)).toBe("overdue");
  });
  it("labels a current clear screening as clear", () => {
    expect(screeningStatusLabel(true, "clear", false)).toBe("clear");
  });
});
