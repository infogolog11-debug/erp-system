import { describe, it, expect } from "vitest";
import { parsePagination, DEFAULT_PAGE_SIZE } from "../parse";

describe("parsePagination", () => {
  it("defaults to page 1 / offset 0 when no page param is given", () => {
    const r = parsePagination({});
    expect(r.page).toBe(1);
    expect(r.offset).toBe(0);
    expect(r.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it("computes offset correctly for page 3", () => {
    const r = parsePagination({ page: "3" }, 20);
    expect(r.page).toBe(3);
    expect(r.offset).toBe(40);
    expect(r.limit).toBe(20);
  });

  it("clamps invalid/negative/zero page values to 1 instead of crashing or going negative", () => {
    expect(parsePagination({ page: "0" }).page).toBe(1);
    expect(parsePagination({ page: "-5" }).page).toBe(1);
    expect(parsePagination({ page: "not-a-number" }).page).toBe(1);
  });

  it("takes the first value when page is an array (duplicate query param)", () => {
    const r = parsePagination({ page: ["2", "9"] }, 10);
    expect(r.page).toBe(2);
    expect(r.offset).toBe(10);
  });
});
