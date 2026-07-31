import { describe, it, expect } from "vitest";
import { buildStandardReportWorkbook } from "./standardReportXlsx";
import { buildReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";

describe("buildStandardReportWorkbook", () => {
  it("produces the six styled passport sheets", async () => {
    const wb = await buildStandardReportWorkbook(buildReportPayloadV2());
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Tổng quan",
      "Cơ sở",
      "Chứng từ",
      "ISO 14067",
      "ESG",
      "CBAM EU",
    ]);
  });

  it("writes a valid xlsx buffer", async () => {
    const wb = await buildStandardReportWorkbook(buildReportPayloadV2());
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(5000);
    expect(Buffer.from(buf.slice(0, 2)).toString("latin1")).toBe("PK");
  });
});
