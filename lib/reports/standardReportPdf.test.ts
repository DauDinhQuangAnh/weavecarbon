// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildStandardReportPdfWithFonts } from "./standardReportPdf";
import { buildReportPayloadV2 } from "@/lib/weave-v2/reportBuilder";

const fonts = () => ({
  regular: readFileSync("public/fonts/BeVietnamPro-Regular.ttf").toString("base64"),
  bold: readFileSync("public/fonts/BeVietnamPro-Bold.ttf").toString("base64"),
});

describe("buildStandardReportPdf", () => {
  it("builds a multi-page vector PDF from a report payload", async () => {
    const payload = buildReportPayloadV2();
    const doc = await buildStandardReportPdfWithFonts(payload, fonts());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);

    const buf = doc.output("arraybuffer") as ArrayBuffer;
    expect(buf.byteLength).toBeGreaterThan(5000);
    const head = Buffer.from(buf.slice(0, 5)).toString("latin1");
    expect(head).toBe("%PDF-");
  });

  it("does not throw on an empty-ish payload", async () => {
    const payload = buildReportPayloadV2();
    const sparse = { ...payload, breakdownRows: [], esgRows: [], cbamRows: [], evidence: [] as typeof payload.evidence };
    const doc = await buildStandardReportPdfWithFonts(sparse, fonts());
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
