import { describe, expect, it } from "vitest";
import { buildMonthlySeriesFromRows } from "./OverviewCharts";

describe("buildMonthlySeriesFromRows (tài khoản thật)", () => {
  it("gộp theo tháng, đổi kg → tCO₂e và chỉ dùng số liệu có thật", () => {
    const result = buildMonthlySeriesFromRows([
      { name: "Áo", sku: "A", month: "2026-10", emissionsKg: 1500 },
      { name: "Áo", sku: "A", month: "2026-11", emissionsKg: 500 },
      { name: "Quần", sku: "B", month: "2026-11", emissionsKg: 250 },
    ]);
    expect(result.series.map((s) => s.key)).toEqual(["A", "B"]);
    expect(result.data).toEqual([
      { month: "T10/2026", A: 1.5, B: 0 },
      { month: "T11/2026", A: 0.5, B: 0.25 },
    ]);
  });

  it("gom sản phẩm ngoài top vào 'Khác' và bỏ dòng không hợp lệ", () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      name: `P${i}`, sku: `S${i}`, month: "2026-09", emissionsKg: 1000 * (8 - i),
    }));
    const result = buildMonthlySeriesFromRows([...rows, { name: "x", sku: "x", month: "bad", emissionsKg: 5 }]);
    expect(result.series).toHaveLength(7);
    expect(result.series[6].label).toBe("Khác (2 SKU)");
    expect(result.data[0].__other).toBe(3);
  });

  it("không có lô thì trả rỗng (không dựng số liệu)", () => {
    expect(buildMonthlySeriesFromRows([]).data).toEqual([]);
  });
});
