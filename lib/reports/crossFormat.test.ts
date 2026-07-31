import { describe, it, expect } from "vitest";
import type { Worksheet } from "exceljs";
import { buildStandardReportWorkbook } from "./standardReportXlsx";
import { buildReportCsvV2 } from "@/lib/weave-v2/reportExporters";
import { buildReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";

const findHeaderRow = (s: Worksheet, firstHeader: string): number => {
  for (let r = 1; r <= 20; r++) if (String(s.getCell(r, 1).value ?? "") === firstHeader) return r;
  return -1;
};

// Phase D: the same payload rendered to PDF / XLSX / CSV must carry identical
// numbers, and the headline PCF must equal the sum of the breakdown line items.
describe("passport cross-format consistency", () => {
  it("XLSX, CSV and payload agree on the PCF breakdown and total", async () => {
    const payload = buildReportPayloadV2();
    const expectedKg = payload.breakdownRows.map((r) => r.kgCo2e.toFixed(4));
    const total = payload.totals.pcfKgPerUnit;

    // ── CSV ──
    const csvLines = buildReportCsvV2(payload)
      .split("\n")
      .filter((l) => l.startsWith("pcf_breakdown"));
    expect(csvLines).toHaveLength(payload.breakdownRows.length);
    csvLines.forEach((line, i) => {
      expect(line).toContain(expectedKg[i]); // kg_co2e value present, in order
    });

    // ── XLSX ──
    const wb = await buildStandardReportWorkbook(payload);
    const s = wb.getWorksheet("Tổng quan")!;
    const hr = findHeaderRow(s, "Giai đoạn");
    expect(hr).toBeGreaterThan(0);

    const xlsxKg: string[] = [];
    let totalCell: number | null = null;
    for (let r = hr + 1; r <= hr + 40; r++) {
      const label = String(s.getCell(r, 1).value ?? "");
      if (label === "") break;
      if (label === "Tổng PCF") {
        totalCell = Number(s.getCell(r, 6).value);
        break;
      }
      xlsxKg.push(Number(s.getCell(r, 6).value).toFixed(4));
    }

    // Every breakdown kg CO₂e matches the payload, in the same order.
    expect(xlsxKg).toEqual(expectedKg);

    // The XLSX total row equals the headline PCF…
    expect(totalCell).not.toBeNull();
    expect(totalCell as number).toBeCloseTo(total, 2);

    // …and the headline PCF equals the sum of the line items (no orphan Scope 1).
    const sum = payload.breakdownRows.reduce((acc, r) => acc + r.kgCo2e, 0);
    expect(sum).toBeCloseTo(total, 2);
  });
});
