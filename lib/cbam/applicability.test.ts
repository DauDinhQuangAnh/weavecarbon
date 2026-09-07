import { describe, expect, it } from "vitest";

import { evaluateCbamApplicability, normalizeHsCode } from "./applicability";

describe("CBAM applicability screening", () => {
  it.each(["61091000", "62052000", "64039996"])(
    "keeps ordinary textile and footwear code %s outside CBAM",
    (code) => expect(evaluateCbamApplicability(code)).toBe("CBAM_NOT_APPLICABLE"),
  );

  it.each(["7208 10 00", "7606.12.92", "2523"])(
    "flags Annex-I heading %s for customs review",
    (code) => expect(evaluateCbamApplicability(code)).toBe("REVIEW_ANNEX_I_MATCH"),
  );

  it("does not guess when the HS/CN code is absent", () => {
    expect(evaluateCbamApplicability(" ")).toBe("CBAM_CODE_MISSING");
    expect(normalizeHsCode("HS 62.05-20")).toBe("620520");
  });
});
