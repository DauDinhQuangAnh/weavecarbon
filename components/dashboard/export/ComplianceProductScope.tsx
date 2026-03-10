"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
"@/components/ui/table";
import { Package, Plus, Trash2, Edit, AlertCircle } from "lucide-react";
import { ProductScopeItem } from "./types";

interface ComplianceProductScopeProps {
  products: ProductScopeItem[];
  marketName: string;
  onAddProduct: () => void;
  onEditProduct: (productId: string) => void;
  onRemoveProduct: (productId: string) => void;
}

const ComplianceProductScope: React.FC<ComplianceProductScopeProps> = ({
  products,
  marketName,
  onAddProduct,
  onEditProduct,
  onRemoveProduct
}) => {
  const t = useTranslations("export.productScope");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const totalVolume = products.reduce((sum, p) => sum + p.exportVolume, 0);

  if (products.length === 0) {
    return (
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-yellow-100">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800">
                {t("noProducts")}
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                {t("noProductsDesc", { market: marketName })}
              </p>
              <Button className="mt-4" size="sm" onClick={onAddProduct}>
                <Plus className="w-4 h-4 mr-1" />
                {t("addProduct")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>);

  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="w-5 h-5 text-primary" />
            {t("title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{t("productCount", { count: products.length })}</Badge>
            <Button size="sm" variant="outline" onClick={onAddProduct}>
              <Plus className="w-4 h-4 mr-1" />
              {t("add")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>{t("productCode")}</TableHead>
                <TableHead>{t("productName")}</TableHead>
                <TableHead>{t("hsCode")}</TableHead>
                <TableHead>{t("productionSite")}</TableHead>
                <TableHead className="text-right">{t("exportVolume")}</TableHead>
                <TableHead className="w-25"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) =>
              <TableRow key={product.productId}>
                  <TableCell className="font-mono text-xs">
                    {product.productId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {product.productName}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {product.hsCode}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {product.productionSite}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {product.exportVolume.toLocaleString(displayLocale)} {product.unit}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onEditProduct(product.productId)}>
                      
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onRemoveProduct(product.productId)}>
                      
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {t("totalExportVolume")}
          </span>
          <span className="text-lg font-bold text-slate-900">
            {totalVolume.toLocaleString(displayLocale)} {t("units")}
          </span>
        </div>
      </CardContent>
    </Card>);

};

export default ComplianceProductScope;
