"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { QrCode } from "lucide-react";
import PassportClient from "@/components/passport/PassportClient";
import { ProductProvider, useProducts } from "@/contexts/ProductContext";
import { formatFixed } from "@/lib/format/number";

/**
 * Opening "Product Passport" from the menu has no ?id=, which used to show the
 * public QR error ("Mã QR này không liên kết…"). Show a product picker instead;
 * the passport itself is unchanged once a product is chosen.
 */
function PassportProductPicker() {
  const pathname = usePathname() || "/passport-dashboard";
  const { products, status } = useProducts();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-start gap-3">
        <QrCode className="mt-1 h-6 w-6 text-emerald-700" />
        <div>
          <h1 className="text-2xl font-bold">Product Passport</h1>
          <p className="text-sm text-muted-foreground">
            Chọn một sản phẩm để xem hộ chiếu sản phẩm và mã QR.
          </p>
        </div>
      </div>

      {status !== "ready" && products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Đang tải danh sách sản phẩm…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có sản phẩm nào. Hãy thêm sản phẩm trước.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`${pathname}?id=${encodeURIComponent(product.id)}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
              >
                <span>
                  <span className="block font-medium">{product.name}</span>
                  <span className="text-xs text-muted-foreground">{product.sku}</span>
                </span>
                <span className="text-sm font-semibold text-emerald-700">
                  {formatFixed(product.co2, 2)} kg CO₂e
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PassportDashboardClient() {
  const searchParams = useSearchParams();
  const hasTarget = Boolean(searchParams.get("id") || searchParams.get("shipmentId"));
  if (hasTarget) return <PassportClient />;
  return (
    <ProductProvider>
      <PassportProductPicker />
    </ProductProvider>
  );
}
