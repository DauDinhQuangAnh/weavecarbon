"use client";

import React from "react";
import { BarChart3, Building2, Download, FileText, History, Package, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CompanyDataExportCardV2Props {
  productCount: number;
  onExportFull: () => void;
}

const CompanyDataExportCardV2: React.FC<CompanyDataExportCardV2Props> = ({ productCount, onExportFull }) => (
  <Card className="rounded-xl border border-emerald-100 bg-white shadow-sm">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        <Download className="h-4 w-4 text-emerald-800" />
        Xuất dữ liệu doanh nghiệp
      </CardTitle>
      <p className="text-sm text-slate-600">
        Tách biệt với DPP / Logistics Portal — phục vụ kế toán nội bộ, audit và analytics.
      </p>
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
        <div className="flex min-w-0 items-center gap-3">
          <Building2 className="h-5 w-5 shrink-0 text-emerald-800" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">Báo cáo doanh nghiệp đầy đủ</p>
            <p className="truncate text-xs text-slate-600">Sản phẩm + Activity + Audit + Users trong 1 file</p>
          </div>
        </div>
        <Button
          size="sm"
          className="h-9 shrink-0 rounded-lg bg-emerald-800 px-4 text-white hover:bg-emerald-900"
          onClick={onExportFull}
        >
          <FileText className="mr-2 h-4 w-4" />
          XLSX
        </Button>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {[
          { label: `Sản phẩm (${productCount})`, icon: Package },
          { label: "Analytics tổng hợp", icon: BarChart3 },
          { label: "Audit log (6)", icon: Shield },
          { label: "Lịch sử tính (3)", icon: History }
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex h-9 items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 text-sm text-slate-950"
            >
              <Icon className="h-4 w-4 text-emerald-900" />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </CardContent>
  </Card>
);

export default CompanyDataExportCardV2;
