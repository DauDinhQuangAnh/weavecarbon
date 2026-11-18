import { describe, expect, it } from "vitest";
import { buildDemoChatAnswer, DEMO_CHAT_NOTICE } from "@/lib/demo/demoChat";

const products = [
  { productCode: "STL-HRC-002", productName: "Thép cuộn cán nóng HRC", quantity: 2, carbonResults: { perProduct: { total: 1944.2 }, totalBatch: { total: 3888.4 }, scope1: 420, scope2: 360, scope3: 1164.2 } },
  { productCode: "CEM-PCB-001", productName: "Xi măng Portland PCB40", quantity: 1, carbonResults: { perProduct: { total: 599 }, totalBatch: { total: 599 }, scope1: 400, scope2: 100, scope3: 99 } }
];

describe("demo Weavey answers", () => {
  it("answers Scope questions with numbers from the dataset", () => {
    const answer = buildDemoChatAnswer("Phát thải Scope 2 tháng 8 là bao nhiêu?", products);
    expect(answer).toContain("Scope 2");
    expect(answer).toContain("0,8 tCO₂e"); // 360*2 + 100*1 = 820 kg
    expect(answer).toContain(DEMO_CHAT_NOTICE);
  });

  it("answers about a named product without diacritics", () => {
    const answer = buildDemoChatAnswer("thep cuon can nong hrc phat thai bao nhieu", products);
    expect(answer).toContain("STL-HRC-002");
    expect(answer).toContain("1.944,2");
  });

  it("falls back to a labelled overview", () => {
    const answer = buildDemoChatAnswer("xin chào", products);
    expect(answer).toContain("3 sản phẩm phát thải lớn nhất");
    expect(answer).toContain(DEMO_CHAT_NOTICE);
  });
});
