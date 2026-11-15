import { describe, expect, it } from "vitest";
import { translateToEnglish } from "./autoTranslate";

describe("translateToEnglish", () => {
  it("translates exact phrases and keeps surrounding whitespace", () => {
    expect(translateToEnglish(" Thử lại ")).toBe(" Try again ");
  });
  it("fills templated phrases", () => {
    expect(translateToEnglish("Trial (còn 5 ngày)")).toBe("Trial (5 days left)");
  });
  it("leaves non-Vietnamese text untouched", () => {
    expect(translateToEnglish("CBAM 2026 · 22.102,7 tCO₂e")).toBe("CBAM 2026 · 22.102,7 tCO₂e");
  });
});

describe("translateToEnglish composites", () => {
  it("translates chart legend labels and separated segments", () => {
    expect(translateToEnglish("Nông nghiệp legend icon")).toBe("Agriculture legend icon");
    expect(translateToEnglish("Thép · Xi măng")).toBe("Steel · Cement");
  });
});

describe("month labels", () => {
  it("maps Vietnamese month abbreviations", () => {
    expect(translateToEnglish("T3/2026")).toBe("Mar 2026");
    expect(translateToEnglish("T1–T8/2026")).toBe("Jan–Aug 2026");
  });
});
