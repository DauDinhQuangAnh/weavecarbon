'use client';

import React from 'react';
import { Download, PackagePlus, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ShipmentExportBundle, ShipmentExportProfile, ShipmentPackage } from '@/lib/weave-v2/shipmentExportApi';

export interface PackingListModalContentProps {
  profile: ShipmentExportProfile;
  update: <K extends keyof ShipmentExportProfile>(field: K, value: ShipmentExportProfile[K]) => void;
  newContainer: {
    containerNumber: string;
    sealNumber: string;
    equipmentType: string;
    marksAndNumbers: string;
    tareWeightKg: string;
    maxGrossWeightKg: string;
  };
  setNewContainer: React.Dispatch<React.SetStateAction<PackingListModalContentProps['newContainer']>>;
  newPackage: {
    packageNumber: string;
    packageType: string;
    marksAndNumbers: string;
    quantity: string;
    netWeightKg: string;
    grossWeightKg: string;
    lengthCm: string;
    widthCm: string;
    heightCm: string;
    contentsText: string;
    containerId: string;
    parentPackageId: string;
    sequenceNo: string;
    weightMeasurementBasis: ShipmentPackage['weightMeasurementBasis'];
    dimensionMeasurementBasis: ShipmentPackage['dimensionMeasurementBasis'];
  };
  setNewPackage: React.Dispatch<React.SetStateAction<PackingListModalContentProps['newPackage']>>;
  bundle: ShipmentExportBundle | null;
  busy: string | null;
  onSave: () => void;
  onAddContainer: () => void;
  onSyncLines: () => void;
  onAddPackage: () => void;
  onGeneratePdf: () => void;
  onDownloadReport: (reportId: string) => void;
  packingListReportId?: string | null;
}

export const PackingListModalContent: React.FC<PackingListModalContentProps> = ({
  profile,
  update,
  newContainer,
  setNewContainer,
  newPackage,
  setNewPackage,
  bundle,
  busy,
  onSave,
  onAddContainer,
  onSyncLines,
  onAddPackage,
  onGeneratePdf,
  onDownloadReport,
  packingListReportId
}) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Số Packing List</Label>
          <Input className="h-8 text-xs font-mono font-bold" value={profile.packingListNumber || ''} onChange={(e) => update('packingListNumber', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Ngày Packing List</Label>
          <Input type="date" className="h-8 text-xs" value={profile.packingListDate || ''} onChange={(e) => update('packingListDate', e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">PO tham chiếu</Label>
          <Input className="h-8 text-xs font-mono" value={profile.poContractId || ''} onChange={(e) => update('poContractId', e.target.value)} />
        </div>
      </div>

      {/* Quản lý Container */}
      <div className="rounded-xl border p-3.5 bg-slate-50/50 space-y-3">
        <b className="text-xs font-bold uppercase text-slate-800">1. Container & Khóa Seal</b>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Số container" className="h-8 text-xs font-mono" value={newContainer.containerNumber} onChange={(e) => setNewContainer((c) => ({ ...c, containerNumber: e.target.value }))} />
          <Input placeholder="Số seal" className="h-8 text-xs font-mono" value={newContainer.sealNumber} onChange={(e) => setNewContainer((c) => ({ ...c, sealNumber: e.target.value }))} />
          <Input placeholder="Loại (40HC)" className="h-8 text-xs" value={newContainer.equipmentType} onChange={(e) => setNewContainer((c) => ({ ...c, equipmentType: e.target.value }))} />
          <Input placeholder="Marks & numbers" className="h-8 text-xs" value={newContainer.marksAndNumbers} onChange={(e) => setNewContainer((c) => ({ ...c, marksAndNumbers: e.target.value }))} />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white"
            onClick={onAddContainer}
            disabled={!newContainer.containerNumber || !newContainer.sealNumber || Boolean(busy)}
          >
            <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm Container
          </Button>
        </div>

        <div className="space-y-1.5">
          {(bundle?.containers || []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded bg-white border text-xs">
              <span className="font-mono font-semibold">{c.containerNumber} / Seal: {c.sealNumber} ({c.equipmentType})</span>
              <Badge variant="outline" className="text-[10px]">Đã gán</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Quản lý Kiện hàng & Pallet */}
      <div className="rounded-xl border p-3.5 bg-slate-50/50 space-y-3">
        <div className="flex items-center justify-between">
          <b className="text-xs font-bold uppercase text-slate-800">2. Kiện hàng ({bundle?.packages.length || 0} kiện)</b>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white"
            onClick={onSyncLines}
            disabled={Boolean(busy)}
          >
            Đồng bộ Dòng hàng SKU
          </Button>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Mã kiện" className="h-8 text-xs" value={newPackage.packageNumber} onChange={(e) => setNewPackage((c) => ({ ...c, packageNumber: e.target.value }))} />
          <Select value={newPackage.packageType} onValueChange={(val) => setNewPackage((c) => ({ ...c, packageType: val }))}>
            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="carton">Carton</SelectItem>
              <SelectItem value="pallet">Pallet</SelectItem>
              <SelectItem value="crate">Crate</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newPackage.containerId} onValueChange={(val) => setNewPackage((c) => ({ ...c, containerId: val }))}>
            <SelectTrigger className="h-8 text-xs bg-white"><SelectValue placeholder="Chọn container" /></SelectTrigger>
            <SelectContent>
              {(bundle?.containers || []).map((c) => <SelectItem key={c.id} value={c.id}>{c.containerNumber}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-white"
            onClick={onAddPackage}
            disabled={!newPackage.packageNumber || !newPackage.containerId || Boolean(busy)}
          >
            <PackagePlus className="mr-1 h-3.5 w-3.5" /> Thêm kiện
          </Button>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
          {(bundle?.packages || []).map((pkg) => (
            <div key={pkg.id} className="flex items-center justify-between p-2 rounded bg-white border text-xs">
              <span>{pkg.packageNumber} ({pkg.packageType}) · {pkg.quantity} chiếc · Net: {pkg.netWeightKg}kg / Gross: {pkg.grossWeightKg}kg</span>
              <Badge variant="outline" className="text-[10px]">Đầy đủ</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Phát hành R02 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t">
        <Button
          size="sm"
          className="bg-emerald-800 hover:bg-emerald-900 text-white"
          disabled={Boolean(busy)}
          onClick={onSave}
        >
          <Save className="mr-1.5 h-4 w-4" /> Lưu thông số R02
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
          {packingListReportId && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDownloadReport(packingListReportId)}
            >
              <Download className="mr-1 h-3.5 w-3.5" /> Tải file
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
