// Hộ chiếu sản phẩm công khai cho chế độ demo: cùng quy tắc với API thật
// (GET /api/passport/:id) để QR demo và QR thật dẫn tới cùng một trang /passport,
// hiển thị giống nhau, chỉ khác nguồn dữ liệu.
//
// Quy tắc giống backend (BE src/services/passportService.js):
// - chỉ sản phẩm đã xuất bản (published) mới có hộ chiếu công khai;
// - lô hàng: ưu tiên lô được chỉ định nếu lô đó thật sự chứa sản phẩm,
//   nếu không thì lấy lô mới cập nhật gần nhất có chứa sản phẩm.

import type { DemoDataset } from "@/lib/demo/schema";
import { getDemoProducts } from "@/lib/demo/domain/products";
import { getDemoShipmentDetails } from "@/lib/demo/domain/logistics";
import { isPublishedProductStatus } from "@/lib/products/productsQueries";
import type { ProductRecord } from "@/lib/productsApi";
import type { LogisticsShipmentDetail } from "@/lib/logisticsApi";

export interface DemoPassportPayload {
  product: ProductRecord | null;
  shipment: LogisticsShipmentDetail | null;
}

const toTime = (value: unknown) => {
  const time = new Date(String(value ?? "")).getTime();
  return Number.isFinite(time) ? time : 0;
};

const shipmentContainsProduct = (shipment: LogisticsShipmentDetail, productId: string) =>
  (shipment.products || []).some((item) => item.productId === productId);

export const resolveDemoPassport = (
  dataset: DemoDataset,
  identifier: string,
  shipmentId?: string | null
): DemoPassportPayload => {
  const lookup = identifier.trim().toLowerCase();
  if (!lookup) return { product: null, shipment: null };

  const product =
    getDemoProducts(dataset).find(
      (item) =>
        item.id.toLowerCase() === lookup ||
        String(item.productCode || "").trim().toLowerCase() === lookup
    ) || null;
  if (!product || !isPublishedProductStatus(product.status)) {
    return { product: null, shipment: null };
  }

  const shipments = getDemoShipmentDetails(dataset).filter((shipment) =>
    shipmentContainsProduct(shipment, product.id)
  );
  const requested = shipmentId?.trim();
  const shipment =
    (requested ? shipments.find((item) => item.id === requested) : undefined) ||
    shipments
      .slice()
      .sort((a, b) => toTime(b.updatedAt) - toTime(a.updatedAt) || toTime(b.createdAt) - toTime(a.createdAt))[0] ||
    null;

  return { product, shipment };
};
