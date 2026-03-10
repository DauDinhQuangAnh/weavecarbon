"use client";

import React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
"@/components/ui/table";

interface HistoryRecord {
  id: string;
  productId: string;
  productName: string;
  materialsCO2: number;
  manufacturingCO2: number;
  transportCO2: number;
  packagingCO2: number;
  totalCO2: number;
  carbonVersion: string;
  createdAt: string;
  createdBy: string;
}

interface HistoryTableProps {
  history: HistoryRecord[];
  onProductClick: (productId: string) => void;
}

const HistoryTable: React.FC<HistoryTableProps> = ({
  history,
  onProductClick
}) => {
  const t = useTranslations("calculationHistory");
  const locale = useLocale();
  const displayLocale = locale === "vi" ? "vi-VN" : "en-US";
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(displayLocale, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <Table className="w-full">
        <TableHeader className="bg-slate-50/80">
          <TableRow className="border-slate-200">
            <TableHead className="font-semibold text-slate-700">{t("columnProduct")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnMaterials")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnManufacturing")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnTransport")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnPackaging")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnTotalCO2")}</TableHead>
            <TableHead className="font-semibold text-slate-700">{t("columnVersion")}</TableHead>
            <TableHead className="font-semibold text-slate-700">{t("columnCreatedDate")}</TableHead>
            <TableHead className="font-semibold text-slate-700">{t("columnCreatedBy")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) =>
          <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50/70">
              <TableCell className="font-medium">
                <button
                onClick={() => onProductClick(item.productId)}
                className="text-left text-slate-800 hover:text-primary hover:underline">

                  {item.productName}
                </button>
              </TableCell>
              <TableCell className="text-right">
                {item.materialsCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {item.manufacturingCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {item.transportCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right">
                {item.packagingCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-bold text-emerald-700">
                {item.totalCO2.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="border border-slate-200 bg-slate-100 text-slate-700 text-xs">
                  {item.carbonVersion}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-slate-600">
                {formatDate(item.createdAt)}
              </TableCell>
              <TableCell className="text-sm text-slate-700 truncate max-w-37.5">
                {item.createdBy}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>);

};

export default HistoryTable;
