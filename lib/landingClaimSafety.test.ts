import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { landingMessages } from "@/components/landing/landingMessages";

const read = (path: string) => readFileSync(path, "utf8");

describe("public landing copy", () => {
  const vi = JSON.stringify(landingMessages.vi);
  const en = JSON.stringify(landingMessages.en);

  it("ships both Vietnamese and English dictionaries with identical keys", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object"
        ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
        : [prefix];
    expect(keys(landingMessages.en).sort()).toEqual(keys(landingMessages.vi).sort());
  });

  it("removes unsupported certification, readiness and verification claims", () => {
    expect(vi).not.toMatch(
      /hồ sơ carbon chuẩn EU|được tin dùng|tính carbon theo ISO 14067|sẵn sàng nộp|hồ sơ nộp được|đã kiểm định độc lập/i
    );
    expect(en).not.toMatch(/certified by|guaranteed compliance|officially verified|trusted by leading/i);
  });

  it("no longer shows the internal-preparation boundary banner in the hero", () => {
    expect(vi).not.toMatch(/phần mềm chuẩn bị dữ liệu nội bộ/i);
    expect(read("components/landing/Hero.tsx")).not.toContain('t("boundary")');
  });

  it("targets industrial and agricultural supply chains rather than fashion", () => {
    expect(`${vi}${en}`).not.toMatch(/dệt may|thời trang|textile|fashion/i);
    expect(read("components/landing/Features.tsx")).not.toMatch(/thời trang bền vững|sustainable fashion/i);
  });
});
