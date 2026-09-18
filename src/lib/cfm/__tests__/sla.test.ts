import { describe, it, expect } from "vitest";
import { computeDueDate, isOverdue, daysOpen } from "../sla";

describe("computeDueDate", () => {
  it("gives critical complaints a 1-day SLA", () => {
    const received = new Date("2026-07-01T00:00:00Z");
    const due = computeDueDate(received, "critical");
    expect(due.toISOString().slice(0,10)).toBe("2026-07-02");
  });

  it("gives low priority complaints a 14-day SLA", () => {
    const received = new Date("2026-07-01T00:00:00Z");
    const due = computeDueDate(received, "low");
    expect(due.toISOString().slice(0,10)).toBe("2026-07-15");
  });

  it("forces sensitive complaints to a 1-day SLA regardless of priority", () => {
    const received = new Date("2026-07-01T00:00:00Z");
    const due = computeDueDate(received, "low", "sensitive");
    expect(due.toISOString().slice(0,10)).toBe("2026-07-02");
  });
});

describe("isOverdue", () => {
  it("flags an open complaint past its due date", () => {
    const today = new Date("2026-07-11");
    expect(isOverdue(new Date("2026-07-05"), "under_review", today)).toBe(true);
  });
  it("does not flag a resolved complaint even if past due date", () => {
    const today = new Date("2026-07-11");
    expect(isOverdue(new Date("2026-07-05"), "resolved", today)).toBe(false);
  });
  it("does not flag a complaint with no due date", () => {
    expect(isOverdue(null, "under_review")).toBe(false);
  });
});

describe("daysOpen", () => {
  it("computes days between received and resolved dates", () => {
    expect(daysOpen(new Date("2026-07-01"), new Date("2026-07-06"))).toBe(5);
  });
  it("computes days open against today when unresolved", () => {
    const today = new Date("2026-07-11");
    expect(daysOpen(new Date("2026-07-01"), null, today)).toBe(10);
  });
});
