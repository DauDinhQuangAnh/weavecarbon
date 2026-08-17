import React, { useEffect, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Package } from "lucide-react";
import { ProductAssessmentData, PRODUCT_CATEGORIES, PRODUCT_TYPES } from "./types";

interface Step1SKUInfoProps {
  data: ProductAssessmentData;
  onChange: (updates: Partial<ProductAssessmentData>) => void;
}

const Step1SKUInfo: React.FC<Step1SKUInfoProps> = ({ data, onChange }) => {
  const t = useTranslations("assessment.step1");
  const hasShownQuantityNoticeRef = useRef(false);

  useEffect(() => {
    if (hasShownQuantityNoticeRef.current) return;
    hasShownQuantityNoticeRef.current = true;

    const storageKey = "assessment_quantity_notice_shown";
    const hasShownInSession =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(storageKey) === "1";

    if (hasShownInSession) return;

    toast.warning(t("quantityNotice.title"), {
      id: "assessment-quantity-note",
      description:
      <ul className="list-disc pl-4 space-y-1 text-sm">
          <li>{t("quantityNotice.item1")}</li>
          <li>{t("quantityNotice.item2")}</li>
          <li>{t("quantityNotice.item3")}</li>
        </ul>

    });

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "1");
    }
  }, [t]);


  const generateSKUPreview = () => {
    if (!data.productCode || !data.quantity || data.quantity <= 0) return [];
    const count = Math.min(data.quantity, 5);
    return Array.from(
      { length: count },
      (_, i) => `${data.productCode}-${String(i + 1).padStart(2, "0")}`
    );
  };

  const skuPreviews = generateSKUPreview();

  // Only show product types belonging to the selected industry (textile vs wood
  // pallet). "Khác" is shared by both.
  const availableProductTypes = useMemo(
    () =>
      PRODUCT_TYPES.filter((type) =>
        type.categories.includes(data.productCategory ?? "textile")
      ),
    [data.productCategory]
  );

  return (
    <div className="space-y-6">
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="productCode">{t("productCodeLabel")}</Label>
          <Input
            id="productCode"
            value={data.productCode}
            onChange={(e) =>
            onChange({ productCode: e.target.value.toUpperCase() })
            }
            placeholder={t("productCodePlaceholder")} />
          
          <p className="text-xs text-muted-foreground">
            {t("productCodeHelp")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="productName">{t("productNameLabel")}</Label>
          <Input
            id="productName"
            value={data.productName}
            onChange={(e) => onChange({ productName: e.target.value })}
            placeholder={t("productNamePlaceholder")} />
          
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ngành hàng / Product category</Label>
        <Select
          value={data.productCategory}
          onValueChange={(v) => {
            const nextCategory = v as ProductAssessmentData["productCategory"];
            // Clear the product type if it doesn't belong to the new industry so
            // the user can't carry an "Áo thun" selection into "Pallet gỗ".
            const productTypeStillValid = PRODUCT_TYPES.some(
              (type) =>
                type.value === data.productType &&
                type.categories.includes(nextCategory)
            );
            onChange({
              productCategory: nextCategory,
              ...(productTypeStillValid ? {} : { productType: "" })
            });
          }}>

          <SelectTrigger className="max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_CATEGORIES.map((category) =>
            <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Quyết định danh mục vật liệu, quy trình sản xuất và phương pháp tính carbon áp dụng cho sản phẩm này.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label>{t("productTypeLabel")}</Label>
          <Select
            value={data.productType}
            onValueChange={(v) => onChange({ productType: v })}>
            
            <SelectTrigger>
              <SelectValue placeholder={t("productTypePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {availableProductTypes.map((type) =>
              <SelectItem key={type.value} value={type.value}>
                  {t.has(`productTypes.${type.value}`) ?
                t(`productTypes.${type.value}`) :
                type.label}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightPerUnit">
            {t("weightPerUnitLabel")}
          </Label>
          <Input
            id="weightPerUnit"
            type="number"
            min="1"
            step="1"
            value={data.weightPerUnit || ""}
            onChange={(e) =>
            onChange({ weightPerUnit: Number(e.target.value) })
            }
            placeholder={t("weightPerUnitPlaceholder")} />
          
          <p className="text-xs text-muted-foreground">
            {t("weightPerUnitHelp")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="hsCode">HS/CN code</Label>
          <Input
            id="hsCode"
            value={data.hsCode || data.cnCode || ""}
            onChange={(e) => onChange({ hsCode: e.target.value.trim(), cnCode: e.target.value.trim() })}
            placeholder="VD: 62052000" />
          <p className="text-xs text-muted-foreground">
            Dùng để đồng bộ CBAM, Commercial Invoice và DPP QR.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="facility">Cơ sở sản xuất / Facility</Label>
          <Input
            id="facility"
            value={data.facility || ""}
            onChange={(e) => onChange({ facility: e.target.value })}
            placeholder="Weave Demo Garment Factory - Hà Nội" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="evidenceLookupCode">Mã tra cứu evidence</Label>
          <Input
            id="evidenceLookupCode"
            value={data.evidenceLookupCode || ""}
            onChange={(e) => onChange({ evidenceLookupCode: e.target.value })}
            placeholder="EVN-HN-009412" />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="supplierCountry">Quốc gia nhà cung ứng Scope 3</Label>
          <Input
            id="supplierCountry"
            value={data.supplierCountry || ""}
            onChange={(e) => onChange({ supplierCountry: e.target.value })}
            placeholder="Vietnam / China / EU" />
        </div>
        <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <Label className="flex items-center gap-2 text-red-800">
            <input
              type="checkbox"
              checked={Boolean(data.supplyGap)}
              onChange={(e) => onChange({ supplyGap: e.target.checked })}
              className="h-4 w-4 rounded border-red-300" />
            Thiếu dữ liệu gốc Scope 3
          </Label>
          <p className="text-xs text-red-700">
            Khi bật, báo cáo sẽ đánh dấu red-flag và áp default value để kiểm toán thấy rõ rủi ro.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="poContractId">PO/Contract ID</Label>
          <Input
            id="poContractId"
            value={data.poContractId || ""}
            onChange={(e) => onChange({ poContractId: e.target.value })}
            placeholder="PO-2026-TXT-099" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billOfLadingNo">Bill of Lading</Label>
          <Input
            id="billOfLadingNo"
            value={data.billOfLadingNo || ""}
            onChange={(e) => onChange({ billOfLadingNo: e.target.value })}
            placeholder="ONEVNHAN260411" />
        </div>
      </div>

      
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <Label htmlFor="quantity" className="text-base font-semibold">
                  {t("quantityLabel")}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("quantityHelp")}
                </p>
              </div>
              <div className="max-w-xs">
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100000"
                  value={data.quantity || ""}
                  onChange={(e) =>
                  onChange({ quantity: Number(e.target.value) })
                  }
                  placeholder={t("quantityPlaceholder")}
                  className="text-lg font-medium" />
                
              </div>

              
              {skuPreviews.length > 0 &&
              <div className="pt-2">
                  <p className="text-sm font-medium mb-2">
                    {t("skuPreviewTitle")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {skuPreviews.map((sku, i) =>
                  <span
                    key={i}
                    className="px-2 py-1 bg-background rounded border text-xs font-mono">
                    
                        {sku}
                      </span>
                  )}
                    {data.quantity > 5 &&
                  <span className="px-2 py-1 text-xs text-muted-foreground">
                        {t("skuPreviewMore", { count: data.quantity - 5 })}
                      </span>
                  }
                  </div>
                </div>
              }
            </div>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default Step1SKUInfo;
