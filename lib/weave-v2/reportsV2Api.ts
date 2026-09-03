import { api } from "@/lib/apiClient";
import type { ReportPayloadV2 } from "./reportBuilder";
import type { CarbonAuthorityReference } from "@/lib/productsApi";

export const saveReportSnapshotV2 = (payload: ReportPayloadV2) =>
  api.post<{
    id: string;
    sku: string | null;
    snapshot_type: string;
    created_at: string;
    payload: ReportPayloadV2;
    carbonAuthority: CarbonAuthorityReference;
  }>("/reports/v2/snapshots", {
    sku: payload.sku.sku,
    productId: payload.sku.id,
    payload,
    styleConfig: payload.colors,
    chartData: {
      pieData: payload.pieData,
      esgRows: payload.esgRows,
      cbamRows: payload.cbamRows
    },
    formulas: Object.fromEntries(
      payload.breakdownRows.map((row, index) => [`row_${index + 1}`, row.formula])
    )
  });
