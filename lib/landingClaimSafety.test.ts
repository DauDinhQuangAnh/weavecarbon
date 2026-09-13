import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("public landing claim containment", () => {
  const messages = JSON.parse(read("locales/vi/common.json"));
  const publicCopy = JSON.stringify({
    hero: messages.hero,
    features: messages.features,
    howItWorks: messages.howItWorks,
    stats: messages.stats,
    cta: messages.cta,
    footer: messages.footer
  });

  it("removes unsupported certification, readiness and verification claims", () => {
    expect(publicCopy).not.toMatch(
      /hồ sơ carbon chuẩn EU|sẵn sàng cho buyer audit|được tin dùng|tính carbon theo ISO 14067|sẵn sàng nộp|mức sẵn sàng theo thị trường|hồ sơ nộp được|xuất hồ sơ tuân thủ|đã kiểm định độc lập/i
    );
  });

  it("states the same-medium boundary prominently in the hero", () => {
    expect(messages.hero.boundary).toMatch(/phần mềm chuẩn bị dữ liệu nội bộ/i);
    expect(messages.hero.boundary).toMatch(/không phải chứng nhận ISO/i);
    expect(messages.hero.boundary).toMatch(/không phải.*kết luận tuân thủ/i);
    expect(read("components/landing/Hero.tsx")).toContain('{t("boundary")}');
  });

  it("keeps proxy, market and output descriptions explicitly limited", () => {
    expect(messages.features.carbonProxy.desc).toMatch(/proxy nội bộ/i);
    expect(messages.features.exportReady.desc).toMatch(/không phải kết luận tuân thủ/i);
    expect(messages.features.cbamDpp.desc).toMatch(/không phải tờ khai registry/i);
    expect(messages.features.recommendations.desc).toMatch(/xác nhận trước khi dùng trong claim/i);
  });

  it("does not reintroduce a generic sustainability headline in component code", () => {
    const featureSource = read("components/landing/Features.tsx");
    expect(featureSource).not.toMatch(/thời trang bền vững|sustainable fashion/i);
  });
});
