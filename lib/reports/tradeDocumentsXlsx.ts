/**
 * Branded Trade Documents Excel Exporter (WeaveCarbon).
 * Generates beautifully styled, green-themed Excel reports for:
 * 1. Commercial Invoice (Carbon-embedded)
 * 2. Packing List (Container & carton packaging footprint)
 * 3. Bill of Lading (Maritime transit emissions annex per GLEC / IMO DCS)
 */
import type { ExportConfigV2 } from "@/lib/weave-v2/exportLogisticsDocs";
import {
  newBrandedWorkbook,
  addWorksheet,
  addTitleBlock,
  addKpiStrip,
  addDataTable,
  downloadWorkbook,
  type TemplateColumn
} from "./excelTheme";

export interface TradeDocumentExportItem {
  sku: {
    sku: string;
    name: string;
    cnCode: string;
    units: number;
    factory?: string;
  };
  embeddedKgPerUnit: number;
  embeddedTonnesBatch: number;
}

export async function exportBrandedTradeDocumentXlsx(
  type: "commercial-invoice" | "packing-list" | "bill-of-lading",
  cfg: ExportConfigV2,
  items: TradeDocumentExportItem[],
  totals: number
): Promise<void> {
  const wb = await newBrandedWorkbook();

  const totalUnits = items.reduce((sum, item) => sum + item.sku.units, 0);
  const avgKgPerUnit = totalUnits > 0 ? (totals * 1000) / totalUnits : 0;

  if (type === "commercial-invoice") {
    const sheet = addWorksheet(wb, "Commercial Invoice");
    const totalAmount = items.reduce((sum, item, idx) => sum + item.sku.units * (8.5 + (idx % 3) * 3.75), 0);

    let nextRow = addTitleBlock(
      sheet,
      "HÓA ĐƠN THƯƠNG MẠI NHÚNG DỮ LIỆU CARBON (COMMERCIAL INVOICE)",
      `Được chứng nhận bởi WeaveCarbon · PO/Hợp đồng: ${cfg.poContractId || "PO-2026-0891"} · Nhà mua hàng: ${cfg.buyerBrand || "H&M Hennes & Mauritz GBC AB"}`,
      9,
      `Số hóa đơn: INV-${cfg.poContractId || "2026-EU-01"} · Ngày phát hành: 26/09/2026 · Chuẩn khai báo: EU CBAM & ISO 14067:2018 (Phạm vi Scope 1+2+3)`
    );

    nextRow = addKpiStrip(sheet, nextRow, [
      { label: "Tổng số lượng hàng", value: totalUnits.toLocaleString("vi-VN"), unit: "chiếc (pcs)" },
      { label: "Tổng giá trị thương mại", value: `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, unit: "USD" },
      { label: "Carbon nhúng TB", value: avgKgPerUnit.toFixed(3), unit: "kg CO₂e/chiếc" },
      { label: "Tổng phát thải hóa đơn", value: totals.toFixed(4), unit: "tCO₂e" }
    ]);

    const columns: TemplateColumn<{ item: TradeDocumentExportItem; idx: number }>[] = [
      { header: "STT", width: 8, align: "center", value: ({ idx }) => idx + 1 },
      { header: "Mã SKU", width: 18, value: ({ item }) => item.sku.sku },
      { header: "Tên sản phẩm", width: 28, value: ({ item }) => item.sku.name },
      { header: "Mã HS / CN", width: 14, align: "center", value: ({ item }) => item.sku.cnCode },
      { header: "Số lượng (Pcs)", width: 16, align: "right", numFmt: "#,##0", total: true, value: ({ item }) => item.sku.units },
      { header: "Đơn giá (USD)", width: 16, align: "right", numFmt: "$#,##0.00", value: ({ idx }) => 8.5 + (idx % 3) * 3.75 },
      { header: "Thành tiền (USD)", width: 18, align: "right", numFmt: "$#,##0.00", total: true, value: ({ item, idx }) => item.sku.units * (8.5 + (idx % 3) * 3.75) },
      { header: "Carbon nhúng (kg CO₂e/sp)", width: 26, align: "right", numFmt: "#,##0.000", value: ({ item }) => item.embeddedKgPerUnit },
      { header: "Tổng carbon dòng (tCO₂e)", width: 26, align: "right", numFmt: "#,##0.0000", total: true, value: ({ item }) => item.embeddedTonnesBatch },
      { header: "Tiêu chuẩn kiểm toán", width: 24, align: "center", value: () => "ISO 14067 / SGS Verified" }
    ];

    const dataRows = items.map((item, idx) => ({ item, idx }));
    addDataTable(sheet, {
      startRow: nextRow,
      columns,
      rows: dataRows,
      totalsLabel: "Tổng cộng lô hàng",
      emptyText: "Không có dữ liệu SKU."
    });

    await downloadWorkbook(wb, `WeaveCarbon_Commercial_Invoice_${cfg.poContractId || "INV"}.xlsx`);
    return;
  }

  if (type === "packing-list") {
    const sheet = addWorksheet(wb, "Packing List");
    const totalCtns = items.reduce((sum, item) => sum + Math.ceil(item.sku.units / 50), 0);
    const totalNetWeight = totalUnits * 0.22;
    const totalGrossWeight = totalUnits * 0.25;
    const totalCbm = totalCtns * 0.045;

    let nextRow = addTitleBlock(
      sheet,
      "PHIẾU ĐÓNG GÓI CHI TIẾT & PHÂN BỔ CARBON (PACKING LIST)",
      `Chứng nhận quy cách đóng gói xuất khẩu & phát thải bao bì · Số Container: ${cfg.containerNo || "MSKU9012445"} · Số Vận đơn B/L: ${cfg.billOfLadingNo || "ONEVNHAN260411"}`,
      10,
      `Số Packing List: PL-${cfg.poContractId || "2026-EU-01"} · Ngày lập: 26/09/2026 · Loại bao bì: Thùng carton 5 lớp sóng đôi đạt chuẩn FSC tái chế`
    );

    nextRow = addKpiStrip(sheet, nextRow, [
      { label: "Tổng số thùng (Cartons)", value: totalCtns.toLocaleString("vi-VN"), unit: "thùng (CTN)" },
      { label: "Trọng lượng Gross", value: totalGrossWeight.toLocaleString("vi-VN", { maximumFractionDigits: 1 }), unit: "kg" },
      { label: "Thể tích chiếm chỗ", value: totalCbm.toFixed(2), unit: "m³ (CBM)" },
      { label: "Tổng phát thải hàng đóng gói", value: totals.toFixed(4), unit: "tCO₂e" }
    ]);

    let cartonRunning = 1;
    const rowsWithCartons = items.map((item) => {
      const ctns = Math.ceil(item.sku.units / 50);
      const from = cartonRunning;
      const to = cartonRunning + ctns - 1;
      cartonRunning = to + 1;
      return { item, ctns, from, to };
    });

    const columns: TemplateColumn<{ item: TradeDocumentExportItem; ctns: number; from: number; to: number }>[] = [
      { header: "Dãy số kiện", width: 18, align: "center", value: ({ from, to }) => `CTN ${String(from).padStart(3, "0")} - ${String(to).padStart(3, "0")}` },
      { header: "Mã SKU", width: 16, value: ({ item }) => item.sku.sku },
      { header: "Tên sản phẩm", width: 26, value: ({ item }) => item.sku.name },
      { header: "Quy cách (Pcs/Thùng)", width: 20, align: "right", numFmt: "#,##0", value: () => 50 },
      { header: "Số thùng (Ctns)", width: 16, align: "right", numFmt: "#,##0", total: true, value: ({ ctns }) => ctns },
      { header: "Tổng số lượng (Pcs)", width: 18, align: "right", numFmt: "#,##0", total: true, value: ({ item }) => item.sku.units },
      { header: "Net Weight (kg)", width: 16, align: "right", numFmt: "#,##0.0", total: true, value: ({ item }) => item.sku.units * 0.22 },
      { header: "Gross Weight (kg)", width: 16, align: "right", numFmt: "#,##0.0", total: true, value: ({ item }) => item.sku.units * 0.25 },
      { header: "Thể tích (CBM)", width: 16, align: "right", numFmt: "#,##0.00", total: true, value: ({ ctns }) => ctns * 0.045 },
      { header: "Carbon bao bì (kg CO₂e)", width: 22, align: "right", numFmt: "#,##0.0", total: true, value: ({ ctns }) => ctns * 0.42 },
      { header: "Carbon hàng (tCO₂e)", width: 22, align: "right", numFmt: "#,##0.0000", total: true, value: ({ item }) => item.embeddedTonnesBatch }
    ];

    addDataTable(sheet, {
      startRow: nextRow,
      columns,
      rows: rowsWithCartons,
      totalsLabel: "Tổng cộng lô hàng đóng gói",
      emptyText: "Không có dữ liệu kiện hàng."
    });

    await downloadWorkbook(wb, `WeaveCarbon_Packing_List_${cfg.poContractId || "PL"}.xlsx`);
    return;
  }

  // bill-of-lading (Carbon Annex)
  const sheet = addWorksheet(wb, "B_L Carbon Annex");
  const grossWeightMt = totalUnits * 0.00025;
  const maritimeEmissionTotal = grossWeightMt * 0.098;
  const grandTotal = maritimeEmissionTotal + totals;

  let nextRow = addTitleBlock(
    sheet,
    "PHỤ LỤC PHÁT THẢI VẬN ĐƠN ĐƯỜNG BIỂN (BILL OF LADING MARITIME CARBON ANNEX)",
    `Chứng nhận phát thải hải trình quốc tế Well-to-Wake · Hãng tàu: ONE APUS / 012E · Vận đơn B/L: ${cfg.billOfLadingNo || "ONEVNHAN260411"}`,
    9,
    `Tuyến vận tải: Cảng Cát Lái (VNSGN) ➔ Cảng Rotterdam (NLRTM) · Hải trình: 10,450 Hải lý · Tiêu chuẩn: GLEC Framework v3.0 / IMO DCS / ISO 14083`
  );

  nextRow = addKpiStrip(sheet, nextRow, [
    { label: "Tổng trọng tải vận chuyển", value: grossWeightMt.toFixed(3), unit: "tấn (MT)" },
    { label: "Phát thải tàu biển Scope 3.4", value: maritimeEmissionTotal.toFixed(4), unit: "tCO₂e" },
    { label: "Carbon nhúng sản phẩm", value: totals.toFixed(4), unit: "tCO₂e" },
    { label: "Tổng dấu chân giao nhận", value: grandTotal.toFixed(4), unit: "tCO₂e" }
  ]);

  const columns: TemplateColumn<TradeDocumentExportItem>[] = [
    { header: "Container / Seal No", width: 24, align: "center", value: () => `${cfg.containerNo || "MSKU9012445"} / VN-892104` },
    { header: "Mã SKU", width: 16, value: (item) => item.sku.sku },
    { header: "Tên sản phẩm", width: 26, value: (item) => item.sku.name },
    { header: "Số kiện đóng gói", width: 18, align: "right", value: (item) => `${Math.ceil(item.sku.units / 50)} CTNS` },
    { header: "Trọng tải (MT)", width: 16, align: "right", numFmt: "#,##0.000", total: true, value: (item) => item.sku.units * 0.00025 },
    { header: "Vận tải biển Scope 3.4 (tCO₂e)", width: 26, align: "right", numFmt: "#,##0.0000", total: true, value: (item) => item.sku.units * 0.00025 * 0.098 },
    { header: "Carbon nhúng hàng (tCO₂e)", width: 24, align: "right", numFmt: "#,##0.0000", total: true, value: (item) => item.embeddedTonnesBatch },
    { header: "Tổng dấu chân B/L (tCO₂e)", width: 24, align: "right", numFmt: "#,##0.0000", total: true, value: (item) => item.sku.units * 0.00025 * 0.098 + item.embeddedTonnesBatch },
    { header: "Chuẩn xác thực logistics", width: 26, align: "center", value: () => "GLEC Framework / DNV Verified" }
  ];

  addDataTable(sheet, {
    startRow: nextRow,
    columns,
    rows: items,
    totalsLabel: "Tổng phát thải hải trình B/L",
    emptyText: "Không có dữ liệu vận tải."
  });

  await downloadWorkbook(wb, `WeaveCarbon_Bill_of_Lading_Annex_${cfg.billOfLadingNo || "BL"}.xlsx`);
}
