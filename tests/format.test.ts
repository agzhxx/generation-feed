import { describe, expect, test } from "vitest";
import { formatCount } from "@/lib/format";

describe("formatCount", () => {
  test("adds a comma every three digits, like toLocaleString('en')", () => {
    for (const value of [0, 7, 42, 999, 1000, 1097, 12345, 340000, 1234567]) {
      expect(formatCount(value)).toBe(value.toLocaleString("en"));
    }
  });

  test("keeps the minus sign of a negative number", () => {
    expect(formatCount(-1097)).toBe("-1,097");
  });
});
