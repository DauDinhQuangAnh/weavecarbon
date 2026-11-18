import { describe, expect, it } from "vitest";
import { PRICING_PLANS, SALES_CONTACT, salesMailto } from "@/lib/pricing/plans";

describe("official price list", () => {
  it("matches the approved pitch-deck prices", () => {
    expect(PRICING_PLANS.starter.priceVnd).toBe(6_000_000);
    expect(PRICING_PLANS.pro.priceVnd).toBe(8_000_000);
    expect(PRICING_PLANS.enterprise.priceVnd).toBeNull();
    expect(PRICING_PLANS.starter.backendPlanId).toBe("standard");
    expect(PRICING_PLANS.pro.backendPlanId).toBe("export");
  });

  it("formats Vietnamese and English price labels", () => {
    expect(PRICING_PLANS.starter.priceLabel.vi).toBe("6.000.000 ₫/tháng");
    expect(PRICING_PLANS.pro.priceLabel.en).toBe("8,000,000 VND/month");
  });

  it("does not promise official report export on Trial", () => {
    expect(PRICING_PLANS.trial.features.vi.join(" ")).toContain("Không xuất báo cáo");
  });

  it("uses one sales contact", () => {
    expect(salesMailto("Pro")).toBe(`mailto:${SALES_CONTACT.email}?subject=Pro`);
  });
});
