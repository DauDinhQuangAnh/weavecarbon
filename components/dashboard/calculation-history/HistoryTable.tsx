"use client";

import React from "react";
import { useTranslations } from "next-intl";
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
  const displayLocale = "vi-VN";
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
    <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-xs">
      <Table className="w-full">
        <TableHeader className="bg-slate-50/90 border-b border-slate-200">
          <TableRow className="border-slate-200 hover:bg-transparent">
            <TableHead className="font-semibold text-slate-700 py-3.5 pl-4">{t("columnProduct")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnMaterials")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnManufacturing")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnTransport")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">{t("columnPackaging")}</TableHead>
            <TableHead className="text-right font-semibold text-slate-800">{t("columnTotalCO2")}</TableHead>
            <TableHead className="font-semibold text-slate-700">{t("columnVersion")}</TableHead>
            <TableHead className="font-semibold text-slate-700">{t("columnCreatedDate")}</TableHead>
            <TableHead className="font-semibold text-slate-700 pr-4">{t("columnCreatedBy")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) =>
          <TableRow key={item.id} className="border-slate-100 hover:bg-slate-50/80 transition-colors">
              <TableCell className="font-medium pl-4">
                <button
                onClick={() => onProductClick(item.productId)}
                className="text-left font-medium text-slate-900 hover:text-emerald-700 hover:underline">

                  {item.productName}
                </button>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-slate-600">
                {item.materialsCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-slate-600">
                {item.manufacturingCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-slate-600">
                {item.transportCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-slate-600">
                {item.packagingCO2.toFixed(2)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-bold text-emerald-700 bg-emerald-50/30">
                {item.totalCO2.toFixed(2)}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="border border-emerald-200/80 bg-emerald-50 text-emerald-800 text-xs font-mono font-medium">
                  {item.carbonVersion}
                </Badge>
              </TableCell>
              <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                {formatDate(item.createdAt)}
              </TableCell>
              <TableCell className="text-xs text-slate-600 truncate max-w-[150px] pr-4">
                {item.createdBy}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>);

};

export default HistoryTable;
