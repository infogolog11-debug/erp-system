import { describe, it, expect } from "vitest";
import { createQueueItem, isRetryExceeded, nextRetryDelaySeconds, sortByQueuedAt } from "../queue-logic";

describe("createQueueItem", () => {
  it("creates an item with 0 attempts and the given payload", () => {
    const item = createQueueItem("beneficiary_registration", { firstName: "Test" });
    expect(item.attempts).toBe(0);
    expect(item.formType).toBe("beneficiary_registration");
    expect(item.payload).toEqual({ firstName: "Test" });
  });

  it("generates unique ids across calls", () => {
    const a = createQueueItem("distribution", {});
    const b = createQueueItem("distribution", {});
    expect(a.id).not.toBe(b.id);
  });
});

describe("isRetryExceeded", () => {
  it("returns false below the max attempts threshold", () => {
    const item = createQueueItem("distribution", {});
    item.attempts = 3;
    expect(isRetryExceeded(item)).toBe(false);
  });
  it("returns true once attempts reach the max", () => {
    const item = createQueueItem("distribution", {});
    item.attempts = 5;
    expect(isRetryExceeded(item)).toBe(true);
  });
});

describe("nextRetryDelaySeconds", () => {
  it("doubles the delay with each attempt", () => {
    expect(nextRetryDelaySeconds(0)).toBe(60);
    expect(nextRetryDelaySeconds(1)).toBe(120);
    expect(nextRetryDelaySeconds(2)).toBe(240);
  });
  it("caps the delay at one hour", () => {
    expect(nextRetryDelaySeconds(10)).toBe(3600);
  });
});

describe("sortByQueuedAt", () => {
  it("sorts items oldest-first", () => {
    const older = { ...createQueueItem("distribution", {}), queuedAt: "2026-01-01T00:00:00Z" };
    const newer = { ...createQueueItem("distribution", {}), queuedAt: "2026-01-02T00:00:00Z" };
    const sorted = sortByQueuedAt([newer, older]);
    expect(sorted[0]).toBe(older);
    expect(sorted[1]).toBe(newer);
  });
});
