import { describe, expect, it } from "vitest";
import { foldVietnamese, matchesSearch } from "@/lib/text/search";

describe("diacritic-insensitive search", () => {
  it("folds Vietnamese text", () => {
    expect(foldVietnamese("Thép cuộn cán nóng")).toBe("thep cuon can nong");
    expect(foldVietnamese("Đường biển")).toBe("duong bien");
  });

  it("matches with or without accents and case", () => {
    expect(matchesSearch("thep", "Thép cuộn cán nóng HRC")).toBe(true);
    expect(matchesSearch("THÉP", "Thép thanh vằn")).toBe(true);
    expect(matchesSearch("stl-hrc", "Thép", "STL-HRC-002")).toBe(true);
    expect(matchesSearch("nhom", "Xi măng")).toBe(false);
  });
});
