'use client';

import React from 'react';
import { Download, Save, Sparkles, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExportParty, ShipmentExportProfile } from '@/lib/weave-v2/shipmentExportApi';

export interface CommercialInvoiceModalContentProps {
  profile: ShipmentExportProfile;
  update: <K extends keyof ShipmentExportProfile>(field: K, value: ShipmentExportProfile[K]) => void;
  updateParty: (party: 'exporter' | 'importer' | 'consignee' | 'notifyParty', field: keyof ExportParty, value: string) => void;
  handleDownloadTemplate: (format?: 'xlsx' | 'csv') => void;
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFillDemoPreset: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  busy: string | null;
  onSave: () => void;
  onGeneratePdf: () => void;
  onDownloadReport: (reportId: string) => void;
  invoiceReportId?: string | null;
}

export const CommercialInvoiceModalContent: React.FC<CommercialInvoiceModalContentProps> = ({
  profile,
  update,
  updateParty,
  handleDownloadTemplate,
  handleFileUpload,
  handleFillDemoPreset,
  fileInputRef,
  busy,
  onSave,
  onGeneratePdf,
  onDownloadReport,
  invoiceReportId
}) => {
  return (
    <div className="space-y-4">
      {/* Thanh công cụ Import / Nạp mẫu R01 */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <b className="text-sm text-emerald-950 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-700" />
            Công cụ nạp tự động thông số Hóa đơn & Hợp đồng
          </b>
          <p className="text-xs text-emerald-800/80 mt-0.5">
            Bạn có thể nạp mẫu 1-click hoặc tải file Excel/CSV từ ERP/kế toán để điền tự động.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="text-xs bg-white h-8" onClick={() => handleDownloadTemplate('xlsx')}>
            <Download className="mr-1 h-3.5 w-3.5" /> Mẫu Excel
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          <Button size="sm" variant="outline" className="text-xs bg-white h-8" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1 h-3.5 w-3.5" /> Upload File
          </Button>
          <Button size="sm" className="bg-emerald-800 hover:bg-emerald-900 text-white text-xs h-8" onClick={handleFillDemoPreset}>
            Nạp mẫu 1-Click
          </Button>
        </div>
      </div>

      {/* Form nhập tay chi tiết */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Số Commercial Invoice</Label>
          <Input className="h-8 text-xs font-mono font-bold" value={profile.invoiceNumber || ''} onChange={(e) => update('invoiceNumber', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Ngày Invoice</Label>
          <Input type="date" className="h-8 text-xs" value={profile.invoiceDate || ''} onChange={(e) => update('invoiceDate', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Nơi phát hành</Label>
          <Input className="h-8 text-xs" value={profile.invoiceIssuePlace || ''} onChange={(e) => update('invoiceIssuePlace', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">PO / Contract ID</Label>
          <Input className="h-8 text-xs font-mono" value={profile.poContractId || ''} onChange={(e) => update('poContractId', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Tiền tệ (ISO 4217)</Label>
          <Input className="h-8 text-xs font-mono" value={profile.currency || 'USD'} onChange={(e) => update('currency', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Điều khoản thanh toán</Label>
          <Input className="h-8 text-xs" value={profile.paymentTerms || ''} onChange={(e) => update('paymentTerms', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Incoterm</Label>
          <Input className="h-8 text-xs" value={profile.incotermCode || 'FOB'} onChange={(e) => update('incotermCode', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Địa điểm Incoterm</Label>
          <Input className="h-8 text-xs" value={profile.incotermLocation || ''} onChange={(e) => update('incotermLocation', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Số tờ khai hải quan</Label>
          <Input className="h-8 text-xs font-mono" value={profile.customsDeclarationNo || ''} onChange={(e) => update('customsDeclarationNo', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Cước vận chuyển (USD)</Label>
          <Input type="number" className="h-8 text-xs" value={profile.freightAmount ?? ''} onChange={(e) => update('freightAmount', e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Bảo hiểm (USD)</Label>
          <Input type="number" className="h-8 text-xs" value={profile.insuranceAmount ?? ''} onChange={(e) => update('insuranceAmount', e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Customs value đối soát</Label>
          <Input type="number" className="h-8 text-xs" value={profile.customsValueAmount ?? ''} onChange={(e) => update('customsValueAmount', e.target.value === '' ? null : Number(e.target.value))} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 pt-2 border-t">
        <div className="rounded-lg border p-3 bg-slate-50/50 space-y-2">
          <b className="text-xs font-bold uppercase text-slate-800">Đơn vị Xuất khẩu (Exporter)</b>
          <Input placeholder="Tên công ty" className="h-8 text-xs" value={profile.exporter.name || ''} onChange={(e) => updateParty('exporter', 'name', e.target.value)} />
          <Input placeholder="Địa chỉ" className="h-8 text-xs" value={profile.exporter.address || ''} onChange={(e) => updateParty('exporter', 'address', e.target.value)} />
          <Input placeholder="Quốc gia (VN)" className="h-8 text-xs" maxLength={2} value={profile.exporter.country || 'VN'} onChange={(e) => updateParty('exporter', 'country', e.target.value.toUpperCase())} />
        </div>
        <div className="rounded-lg border p-3 bg-slate-50/50 space-y-2">
          <b className="text-xs font-bold uppercase text-slate-800">Đơn vị Nhập khẩu (Importer)</b>
          <Input placeholder="Tên công ty buyer" className="h-8 text-xs" value={profile.importer.name || ''} onChange={(e) => updateParty('importer', 'name', e.target.value)} />
          <Input placeholder="Địa chỉ" className="h-8 text-xs" value={profile.importer.address || ''} onChange={(e) => updateParty('importer', 'address', e.target.value)} />
          <Input placeholder="EORI của importer" className="h-8 text-xs font-mono" value={profile.importerEori || ''} onChange={(e) => update('importerEori', e.target.value)} />
        </div>
      </div>

      {/* Phát hành R01 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
        <Button
          size="sm"
          className="bg-emerald-800 hover:bg-emerald-900 text-white"
          disabled={Boolean(busy)}
          onClick={onSave}
        >
          <Save className="mr-1.5 h-4 w-4" /> Lưu thông số R01
        </Button>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={Boolean(busy)}
            onClick={onGeneratePdf}
          >
            Tạo bản review PDF
          </Button>
          {invoiceReportId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDownloadReport(invoiceReportId)}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Tải file
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
