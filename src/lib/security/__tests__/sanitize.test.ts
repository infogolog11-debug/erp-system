import { describe, it, expect } from "vitest";
import { textField, optionalTextField, sanitizeText } from "../sanitize";

describe("textField", () => {
  it("strips script tags but leaves the inner text (matches Nexus's approach)", () => {
    const schema = textField(200);
    const result = schema.parse("<script>alert(1)</script>مرحبا");
    expect(result).not.toContain("<script>");
    expect(result).toContain("مرحبا");
  });

  it("strips img/onerror-style tags", () => {
    const schema = textField(200);
    const result = schema.parse('<img src=x onerror=alert(1)>محتوى');
    expect(result).toBe("محتوى");
  });

  it("trims surrounding whitespace", () => {
    const schema = textField(200);
    expect(schema.parse("  نص  ")).toBe("نص");
  });

  it("enforces a minimum length before transform", () => {
    const schema = textField(200, 3);
    expect(() => schema.parse("ab")).toThrow();
  });

  it("enforces a maximum length", () => {
    const schema = textField(5);
    expect(() => schema.parse("123456")).toThrow();
  });

  it("leaves plain text without tags unchanged", () => {
    const schema = textField(200);
    expect(schema.parse("نص عادي بدون أي وسوم")).toBe("نص عادي بدون أي وسوم");
  });
});

describe("optionalTextField", () => {
  it("allows undefined", () => {
    const schema = optionalTextField(200);
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it("still sanitizes when a value is provided", () => {
    const schema = optionalTextField(200);
    expect(schema.parse("<b>bold</b>text")).toBe("boldtext");
  });
});

describe("sanitizeText", () => {
  it("strips tags from a raw string", () => {
    expect(sanitizeText("<div>hello</div>")).toBe("hello");
  });
  it("handles strings with no tags", () => {
    expect(sanitizeText("plain")).toBe("plain");
  });
});
