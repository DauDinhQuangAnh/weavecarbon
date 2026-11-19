// Nội dung CHỈ dùng cho /demo: các tuyên bố xác minh/kiểm toán dưới đây là kịch bản minh hoạ,
// không được hiển thị cho tài khoản thật (xem REAL_EXPORT_COPY trong cổng xuất khẩu).
export const DEMO_EXPORT_COPY = {
  tradeDocsTitle: "Chứng từ Vận tải & Thương mại nhúng Carbon (WeaveCarbon Verified)",
  sealTitle: "Chứng thực Dấu chân Carbon WeaveCarbon Trust Engine",
  sealAuditorPrefix: "Đơn vị kiểm toán độc lập:",
  sealAuditorName: "SGS Vietnam",
  placeholderHash: "7f8a92b0c1e4...8a2f",
  dppAuditorLine: "Đơn vị kiểm toán độc lập: SGS Vietnam · Tiêu chuẩn ISO 14067",
  qrVerifiedLine: "Verified by SGS Vietnam",
  preAuditTitle: "Pre-Audit Pack — Sẵn sàng kiểm toán SGS / BV / CBAM",
  auditReadyBadge: "AUDIT-READY",
  originalDocsHeading: "HỒ SƠ CHỨNG TỪ GỐC (TẢI VỀ CHO KIỂM TOÁN VIÊN SGS / TÜV RHEINLAND)",
  invoiceCopy:
    "Phục vụ thanh toán ngân hàng & Hải quan EU: Bổ sung đơn giá, thành tiền, chỉ số phát thải carbon (kg CO₂e/đơn vị) và tổng phát thải để khai báo thuế CBAM.",
  ladingCopy:
    "Phục vụ hãng tàu & logistics: Đo lường phát thải vận tải biển quốc tế Well-to-Wake (chuẩn GLEC / IMO DCS) từ cảng Cát Lái (VN) đến Rotterdam (EU).",
  invoiceHeader: (buyer: string, po: string) =>
    `Nhà mua hàng: ${buyer || "EuroSteel Trading GmbH (demo)"} · Hợp đồng/PO: ${po || "PO-2026-0891"} · Ngày phát hành: 26/09/2026`,
  packingHeader: (container: string, grossKg: string) =>
    `Số hiệu Container: ${container || "MSKU9012445"} · Đóng gói: Thùng carton 5 lớp FSC · Trọng tải: ${grossKg} kg`,
  ladingHeader: "Hải trình: Cảng Cát Lái (VNSGN) ➔ Cảng Rotterdam (NLRTM) · Tàu: ONE APUS / 012E · Khoảng cách: 10,450 Hải lý",
  ladingRouteNote: "Hải trình 10,450 NM (Cát Lái ➔ Rotterdam) theo GLEC v3.0",
  ladingTotalNote: "Đầy đủ vòng đời vận chuyển quốc tế bàn giao tại cảng EU",
  containerFallback: "MSKU9012445",
  containerSeal: "/ VN-892104",
} as const;
