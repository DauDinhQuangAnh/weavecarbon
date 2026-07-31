import { describe, it, expect } from "vitest";
import { sanitizeCsvValue, csvField, toCsv } from "./csv";

describe("sanitizeCsvValue (formula-injection defence)", () => {
  it("neutralises formula-triggering values", () => {
    expect(sanitizeCsvValue("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(sanitizeCsvValue("@cmd")).toBe("'@cmd");
    expect(sanitizeCsvValue("+cmd()")).toBe("'+cmd()");
    expect(sanitizeCsvValue("-2+3+cmd|'/C calc'!A0")).toBe("'-2+3+cmd|'/C calc'!A0");
    expect(sanitizeCsvValue("\t=1")).toBe("'\t=1");
  });

  it("preserves legitimate numbers (including negatives)", () => {
    expect(sanitizeCsvValue("-5.2")).toBe("-5.2");
    expect(sanitizeCsvValue("+5")).toBe("+5");
    expect(sanitizeCsvValue("-1000")).toBe("-1000");
    expect(sanitizeCsvValue("3.14e-2")).toBe("3.14e-2");
  });

  it("leaves ordinary text and empty untouched", () => {
    expect(sanitizeCsvValue("Áo thun Cotton")).toBe("Áo thun Cotton");
    expect(sanitizeCsvValue("2+2")).toBe("2+2"); // does not start with a trigger char
    expect(sanitizeCsvValue("")).toBe("");
    expect(sanitizeCsvValue(null)).toBe("");
  });

  it("csvField quotes when needed and sanitises first", () => {
    expect(csvField("a,b")).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField("=1,2")).toBe('"\'=1,2"'); // sanitised (') then quoted (comma)
    expect(csvField("plain")).toBe("plain");
  });

  it("toCsv builds a BOM-prefixed, injection-safe document", () => {
    const csv = toCsv(["name", "co2e"], [
      { name: "=HYPERLINK(1)", co2e: -3.5 },
      { name: "Vải cotton", co2e: 12 },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain("-3.5"); // negative number preserved
  });
});
