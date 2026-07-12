'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from '@e965/xlsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProducts } from '@/contexts/ProductContext';
import { api } from '@/lib/apiClient';
import { useDashboardTitle } from '@/contexts/DashboardContext';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Building2,
  CheckCircle2,
  Download,
  ExternalLink,
  Factory,
  FileBarChart,
  FileText,
  Link2,
  Loader2,
  Package2,
  Pencil,
  ShieldAlert,
  Trash2,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';

interface ElectricityInvoice {
  id: string;
  billing_period: string;
  facility_name: string;
  kwh: number;
  emission_factor_kg_per_kwh: number;
  emission_factor_source: string | null;
  scope2_co2e_kg: number;
  status: string;
  evidence_document_id: string | null;
}

interface FuelInvoice {
  id: string;
  billing_period: string;
  fuel_type: string;
  quantity_liters: number;
  emission_factor_kg_per_liter: number | null;
  scope1_co2e_kg: number | null;
  status: string;
  evidence_document_id: string | null;
}

interface EvidenceDoc {
  id: string;
  kind: string | null;
  status: string | null;
}

interface CarbonCalc {
  id: string;
  productId: string | null;
  totalCo2e: number;
  materialsCo2e: number | null;
  productionCo2e: number | null;
  transportCo2e: number | null;
  packagingCo2e: number | null;
}

interface CompanyData {
  name: string;
  business_type: string | null;
  target_markets: string[] | null;
  address?: string | null;
  tax_id?: string | null;
  phone?: string | null;
}

// SAC Higg FEM + BREF Textile BAT 2017 + Ecoinvent v3.10
const TEXTILE_PROCESSES = [
  { key: 'knitting',  label: 'Dệt kim (Knitting)',         defaultFactor: 1.8,  unit: 'kWh/kg' },
  { key: 'weaving',   label: 'Dệt thoi (Weaving)',          defaultFactor: 2.2,  unit: 'kWh/kg' },
  { key: 'dyeing',    label: 'Nhuộm (Dyeing)',              defaultFactor: 5.5,  unit: 'kWh/kg' },
  { key: 'printing',  label: 'In (Printing)',               defaultFactor: 2.5,  unit: 'kWh/kg' },
  { key: 'cutting',   label: 'Cắt & May (Cutting/Sewing)',  defaultFactor: 1.2,  unit: 'kWh/kg' },
  { key: 'washing',   label: 'Giặt (Washing)',              defaultFactor: 2.0,  unit: 'kWh/kg' },
  { key: 'finishing', label: 'Hoàn tất (Finishing)',        defaultFactor: 1.5,  unit: 'kWh/kg' },
  { key: 'packaging', label: 'Đóng gói (Packaging)',        defaultFactor: 0.3,  unit: 'kWh/kg' },
];

const EVIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  verified:       { label: 'Đã xác minh',    className: 'bg-emerald-100 text-emerald-700' },
  cross_checked:  { label: 'Đối chiếu chéo', className: 'bg-sky-100 text-sky-700' },
  source_matched: { label: 'Khớp nguồn',     className: 'bg-sky-100 text-sky-700' },
  ocr_parsed:     { label: 'AI đọc',         className: 'bg-amber-100 text-amber-700' },
  uploaded:       { label: 'Đã tải lên',     className: 'bg-amber-100 text-amber-700' },
  pending:        { label: 'Chờ xử lý',      className: 'bg-slate-100 text-slate-700' },
  missing:        { label: 'Thiếu chứng từ', className: 'bg-red-100 text-red-700' },
};

function EvidenceBadge({ status }: { status?: string | null }) {
  const meta = EVIDENCE_BADGE[status ?? 'missing'] ?? EVIDENCE_BADGE.missing;
  return <Badge variant="secondary" className={meta.className}>{meta.label}</Badge>;
}

const Row: React.FC<{ label: string; value: React.ReactNode; source: string }> = ({
  label, value, source,
}) => (
  <TableRow>
    <TableCell className="text-xs text-muted-foreground w-1/3">{label}</TableCell>
    <TableCell className="text-sm font-medium">{value}</TableCell>
    <TableCell className="text-[11px] text-muted-foreground text-right">{source}</TableCell>
  </TableRow>
);

const KpiCard: React.FC<{ label: string; value: string; sub?: string; link?: string }> = ({
  label, value, sub, link,
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription className="text-xs">{label}</CardDescription>
      <CardTitle className="text-lg font-bold">{value}</CardTitle>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </CardHeader>
    {link && (
      <CardContent className="pt-0">
        <Link href={link} className="text-xs text-primary inline-flex items-center gap-1">
          <Link2 className="w-3 h-3" />Xem chứng từ
        </Link>
      </CardContent>
    )}
  </Card>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1">
    <h4 className="font-semibold text-sm">{title}</h4>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-2 rounded border bg-muted/30">
    <p className="text-[10px] text-muted-foreground">{label}</p>
    <p className="font-mono font-semibold">{value}</p>
  </div>
);

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return ok ? (
    <li className="flex items-center gap-2 text-xs text-emerald-700">
      <CheckCircle2 className="w-3 h-3 shrink-0" /> {label}
    </li>
  ) : (
    <li className="flex items-center gap-2 text-xs text-red-600">
      <XCircle className="w-3 h-3 shrink-0" /> {label}
    </li>
  );
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR];

export default function CbamReportPage() {
  const { products } = useProducts();
  const router = useRouter();
  const { setPageTitle } = useDashboardTitle();

  const [company, setCompany]         = useState<CompanyData | null>(null);
  const [electricity, setElectricity] = useState<ElectricityInvoice[]>([]);
  const [fuels, setFuels]             = useState<FuelInvoice[]>([]);
  const [evidence, setEvidence]       = useState<EvidenceDoc[]>([]);
  const [calcs, setCalcs]             = useState<CarbonCalc[]>([]);
  const [exporting, setExporting]     = useState(false);
  const [saving, setSaving]           = useState(false);

  // Electricity invoice CRUD modal
  type ElecForm = { facility_name: string; billing_period: string; kwh: string; emission_factor_kg_per_kwh: string; emission_factor_source: string };
  const defaultElecForm: ElecForm = { facility_name: 'Main Facility', billing_period: '', kwh: '', emission_factor_kg_per_kwh: '0.4290', emission_factor_source: 'VN Ministry of Natural Resources 2024' };
  const [elecModalOpen, setElecModalOpen] = useState(false);
  const [elecEditing, setElecEditing]     = useState<ElectricityInvoice | null>(null);
  const [elecForm, setElecForm]           = useState<ElecForm>(defaultElecForm);

  // Fuel invoice CRUD modal
  type FuelForm = { billing_period: string; fuel_type: string; quantity_liters: string; emission_factor_kg_per_liter: string };
  const defaultFuelForm: FuelForm = { billing_period: '', fuel_type: 'diesel', quantity_liters: '', emission_factor_kg_per_liter: '' };
  const [fuelModalOpen, setFuelModalOpen] = useState(false);
  const [fuelEditing, setFuelEditing]     = useState<FuelInvoice | null>(null);
  const [fuelForm, setFuelForm]           = useState<FuelForm>(defaultFuelForm);


  const [selectedYear, setSelectedYear]       = useState(CURRENT_YEAR);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);

  const reportingPeriod = `${selectedYear} Q${selectedQuarter}`;
  const periodStart = new Date(selectedYear, (selectedQuarter - 1) * 3, 1).toISOString().slice(0, 10);
  const periodEnd   = new Date(selectedYear, selectedQuarter * 3, 0).toISOString().slice(0, 10);

  useEffect(() => {
    setPageTitle('Báo cáo CBAM-style', 'Cấu trúc 6 tab phỏng theo EU CBAM communication template.');
  }, [setPageTitle]);

  const loadInvoices = useCallback(async () => {
    const [e, f] = await Promise.allSettled([
      api.get<ElectricityInvoice[]>('/electricity-invoices'),
      api.get<FuelInvoice[]>('/fuel-invoices'),
    ]);
    if (e.status === 'fulfilled') setElectricity(e.value ?? []);
    if (f.status === 'fulfilled') setFuels(f.value ?? []);
  }, []);

  useEffect(() => {
    api.get<{ company?: CompanyData }>('/account')
      .then((res) => { if (res?.company) setCompany(res.company); })
      .catch(() => {});

    Promise.allSettled([
      api.get<ElectricityInvoice[]>('/electricity-invoices'),
      api.get<FuelInvoice[]>('/fuel-invoices'),
      api.get<{ items?: EvidenceDoc[] } | EvidenceDoc[]>('/evidence?page=1&page_size=100'),
      api.get<{ data?: CarbonCalc[]; meta?: unknown } | CarbonCalc[]>('/carbon-calculations?limit=200'),
    ]).then(([e, f, ev, k]) => {
      if (e.status === 'fulfilled') setElectricity(e.value ?? []);
      if (f.status === 'fulfilled') setFuels(f.value ?? []);
      if (ev.status === 'fulfilled') {
        const evData = ev.value;
        setEvidence(Array.isArray(evData) ? evData : (evData as { items?: EvidenceDoc[] }).items ?? []);
      }
      if (k.status === 'fulfilled') {
        const raw = k.value;
        setCalcs(Array.isArray(raw) ? raw : (raw as { data?: CarbonCalc[] }).data ?? []);
      }
    });
  }, []);

  // ── Electricity CRUD ────────────────────────────────────────────────────────
  const openEditElec = (inv: ElectricityInvoice) => {
    setElecEditing(inv);
    setElecForm({ facility_name: inv.facility_name, billing_period: inv.billing_period, kwh: String(inv.kwh), emission_factor_kg_per_kwh: String(inv.emission_factor_kg_per_kwh), emission_factor_source: inv.emission_factor_source ?? '' });
    setElecModalOpen(true);
  };
  const handleSaveElec = async () => {
    if (!elecForm.billing_period || !elecForm.kwh) return;
    setSaving(true);
    try {
      const payload = { facility_name: elecForm.facility_name || 'Main Facility', billing_period: elecForm.billing_period, kwh: parseFloat(elecForm.kwh), emission_factor_kg_per_kwh: parseFloat(elecForm.emission_factor_kg_per_kwh) || 0.4290, emission_factor_source: elecForm.emission_factor_source };
      if (elecEditing) await api.put(`/electricity-invoices/${elecEditing.id}`, payload);
      else await api.post('/electricity-invoices', payload);
      setElecModalOpen(false);
      await loadInvoices();
    } catch { /* ignore */ } finally { setSaving(false); }
  };
  const handleDeleteElec = async (id: string) => {
    if (!window.confirm('Xoá hóa đơn điện này? Chứng từ liên kết cũng sẽ bị xoá.')) return;
    const inv = electricity.find((e) => e.id === id);
    await api.delete(`/electricity-invoices/${id}`).catch(() => {});
    if (inv?.evidence_document_id) await api.delete(`/evidence/${inv.evidence_document_id}`).catch(() => {});
    await loadInvoices();
  };

  // ── Fuel CRUD ───────────────────────────────────────────────────────────────
  const openEditFuel = (inv: FuelInvoice) => {
    setFuelEditing(inv);
    setFuelForm({ billing_period: inv.billing_period, fuel_type: inv.fuel_type, quantity_liters: String(inv.quantity_liters), emission_factor_kg_per_liter: inv.emission_factor_kg_per_liter ? String(inv.emission_factor_kg_per_liter) : '' });
    setFuelModalOpen(true);
  };
  const handleSaveFuel = async () => {
    if (!fuelForm.billing_period || !fuelForm.quantity_liters) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { billing_period: fuelForm.billing_period, fuel_type: fuelForm.fuel_type, quantity_liters: parseFloat(fuelForm.quantity_liters) };
      if (fuelForm.emission_factor_kg_per_liter) payload.emission_factor_kg_per_liter = parseFloat(fuelForm.emission_factor_kg_per_liter);
      if (fuelEditing) await api.put(`/fuel-invoices/${fuelEditing.id}`, payload);
      else await api.post('/fuel-invoices', payload);
      setFuelModalOpen(false);
      await loadInvoices();
    } catch { /* ignore */ } finally { setSaving(false); }
  };
  const handleDeleteFuel = async (id: string) => {
    if (!window.confirm('Xoá hóa đơn nhiên liệu này? Chứng từ liên kết cũng sẽ bị xoá.')) return;
    const inv = fuels.find((f) => f.id === id);
    await api.delete(`/fuel-invoices/${id}`).catch(() => {});
    if (inv?.evidence_document_id) await api.delete(`/evidence/${inv.evidence_document_id}`).catch(() => {});
    await loadInvoices();
  };

  const totals = useMemo(() => {
    const scope1 = fuels.reduce((s, f) => s + (Number(f.scope1_co2e_kg) || 0), 0);
    const scope2 = electricity.reduce((s, e) => s + (Number(e.scope2_co2e_kg) || 0), 0);
    // Scope 3: actual upstream breakdown from carbon_calculations
    const scope3 = calcs.reduce(
      (s, c) => s + (Number(c.materialsCo2e) || 0) + (Number(c.transportCo2e) || 0) + (Number(c.packagingCo2e) || 0),
      0,
    );
    const totalKwh = electricity.reduce((s, e) => s + (Number(e.kwh) || 0), 0);
    return { scope1, scope2, scope3, total: scope1 + scope2 + scope3, totalKwh };
  }, [fuels, electricity, calcs]);

  const evidenceByKind = useMemo(() => {
    const map: Record<string, EvidenceDoc[]> = {};
    for (const e of evidence) {
      const k = e.kind ?? 'other';
      (map[k] ??= []).push(e);
    }
    return map;
  }, [evidence]);

  const productSummary = useMemo(() => {
    return products.map((p) => {
      const calc = calcs.find((c) => c.productId === p.id);
      const total = calc?.totalCo2e ?? p.co2 ?? 0;
      // Direct = manufacturing energy (Scope 1+2 allocated to this product)
      const direct = calc?.productionCo2e ?? total * 0.3;
      // Indirect = upstream materials + transport + packaging (Scope 3)
      const indirect = calc
        ? (calc.materialsCo2e ?? 0) + (calc.transportCo2e ?? 0) + (calc.packagingCo2e ?? 0)
        : total * 0.7;
      const weight = p.weight ?? 0;
      // CBAM core metric: tCO2e per tonne of product (direct emissions only)
      const embeddedPerTonne = weight > 0 ? (direct / 1000) / (weight / 1000) : null;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        weight,
        materials: p.materials ?? [],
        direct,
        indirect,
        total: direct + indirect,
        embeddedPerTonne,
        proxyPct: Math.max(0, 100 - (p.confidenceScore ?? 50)),
        confidence: p.confidenceScore ?? 50,
        hasCalc: !!calc,
      };
    });
  }, [products, calcs]);

  const checks = useMemo(() => {
    const items: { ok: boolean; label: string }[] = [
      { ok: !!(company?.name),                                        label: 'Tên doanh nghiệp' },
      { ok: !!(company?.business_type),                               label: 'Loại hình kinh doanh' },
      { ok: !!(company?.target_markets?.length),                      label: 'Thị trường mục tiêu' },
      { ok: !!(company?.address),                                     label: 'Địa chỉ nhà máy' },
      { ok: electricity.length > 0,                                   label: 'Hóa đơn điện (Scope 2)' },
      { ok: fuels.length > 0,                                         label: 'Hóa đơn nhiên liệu (Scope 1)' },
      { ok: products.length > 0,                                      label: 'Danh sách sản phẩm' },
      { ok: calcs.length > 0,                                         label: 'Tính toán carbon theo SKU' },
      { ok: evidence.length > 0,                                      label: 'Chứng từ tải lên' },
      { ok: evidence.some((e) => ['verified', 'cross_checked', 'source_matched'].includes(e.status ?? '')),
        label: 'Chứng từ đã xác minh' },
    ];
    const score = items.filter((i) => i.ok).length;
    return { items, score, total: items.length, pct: Math.round((score / items.length) * 100) };
  }, [company, electricity, fuels, products, calcs, evidence]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Trường', 'Giá trị', 'Nguồn'],
        ['Tên doanh nghiệp',    company?.name ?? '',                                  'companies.name'],
        ['Loại hình KD',        company?.business_type ?? '',                         'companies.business_type'],
        ['Địa chỉ',             company?.address ?? '',                               'companies.address'],
        ['Mã số thuế / EORI',   company?.tax_id ?? '',                                'companies.tax_id'],
        ['Kỳ báo cáo',          reportingPeriod,                                      'selected'],
        ['Từ ngày',             periodStart,                                          'computed'],
        ['Đến ngày',            periodEnd,                                            'computed'],
        ['Thị trường mục tiêu', (company?.target_markets ?? []).join(', '),          'companies.target_markets'],
      ]), 'A_Facility');

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Kỳ', 'Cơ sở', 'kWh', 'EF (kg/kWh)', 'Nguồn EF', 'CO₂e (kg)', 'Trạng thái'],
        ...electricity.map((e) => [
          e.billing_period, e.facility_name, e.kwh,
          e.emission_factor_kg_per_kwh, e.emission_factor_source ?? 'EVN 2024',
          e.scope2_co2e_kg, e.status,
        ]),
      ]), 'B_Electricity_S2');

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Kỳ', 'Loại nhiên liệu', 'Lượng (L)', 'EF (kg/L)', 'CO₂e (kg)', 'Trạng thái'],
        ...fuels.map((f) => [
          f.billing_period, f.fuel_type, f.quantity_liters,
          f.emission_factor_kg_per_liter ?? 0, f.scope1_co2e_kg ?? 0, f.status,
        ]),
      ]), 'C_Fuel_S1');

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['SKU', 'Tên SP', 'Khối lượng (kg)', 'Vật liệu',
         'Direct (kg CO₂e)', 'Indirect (kg CO₂e)', 'Tổng (kg CO₂e)',
         'Embedded (tCO₂e/tấn SP)', '% Proxy', 'Confidence', 'Nguồn tính toán'],
        ...productSummary.map((p) => [
          p.sku, p.name, p.weight, p.materials.join(', '),
          +p.direct.toFixed(3), +p.indirect.toFixed(3), +p.total.toFixed(3),
          p.embeddedPerTonne != null ? +p.embeddedPerTonne.toFixed(4) : '',
          p.proxyPct, p.confidence,
          p.hasCalc ? 'Tính toán thực' : 'Proxy (hệ số mặc định)',
        ]),
      ]), 'D_Products_Embedded');

      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Chỉ tiêu', 'Giá trị', 'Đơn vị'],
        ['Kỳ báo cáo',                  reportingPeriod, ''],
        ['Scope 1',                      +totals.scope1.toFixed(2), 'kg CO₂e'],
        ['Scope 2',                      +totals.scope2.toFixed(2), 'kg CO₂e'],
        ['Scope 3',                      +totals.scope3.toFixed(2), 'kg CO₂e'],
        ['Tổng phát thải',               +totals.total.toFixed(2),  'kg CO₂e'],
        ['Điện tiêu thụ',                totals.totalKwh,            'kWh'],
        ['Số SKU',                       products.length,            'sản phẩm'],
        ['Chứng từ tải lên',             evidence.length,            'tài liệu'],
        ['Mức hoàn chỉnh',               `${checks.pct}%`,           `(${checks.score}/${checks.total})`],
        ['Disclaimer', 'Báo cáo tiền-thẩm tra — không phải tờ khai CBAM chính thức (EU 2023/956)', ''],
      ]), 'Summary');

      const filename = `WeaveCarbon_CBAM_${reportingPeriod.replace(' ', '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 p-6 space-y-4">
      {/* Header + controls */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Báo cáo carbon theo cấu trúc CBAM-style</h1>
          <p className="text-sm text-muted-foreground mt-1">
            6 tab phỏng theo EU CBAM communication template — dệt may, da giày &amp; xuất khẩu.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(Number(v))}>
            <SelectTrigger className="w-20 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)} className="text-xs">Q{q}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleExport} disabled={exporting} className="h-8 text-xs gap-1">
            <Download className="w-3 h-3" />
            {exporting ? 'Đang xuất…' : 'Xuất XLSX'}
          </Button>
        </div>
      </div>

      {/* Completeness score card */}
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Mức độ hoàn chỉnh báo cáo</CardTitle>
            <Badge
              variant="secondary"
              className={
                checks.pct >= 80 ? 'bg-emerald-100 text-emerald-700'
                : checks.pct >= 50 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700'
              }
            >
              {checks.pct}% — {checks.score}/{checks.total} mục
            </Badge>
          </div>
          <Progress value={checks.pct} className="h-2 mt-2" />
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-1 mt-1">
            {checks.items.map((item) => <CheckItem key={item.label} ok={item.ok} label={item.label} />)}
          </ul>
        </CardContent>
      </Card>

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900">Báo cáo carbon tiền-thẩm tra (pre-audit)</AlertTitle>
        <AlertDescription className="text-amber-800 text-xs">
          Không phải tờ khai CBAM, không phải chứng nhận. Dệt may hiện chưa thuộc phạm vi CBAM (EU 2023/956) —
          cấu trúc 6 tab phỏng theo mẫu DG TAXUD và phục vụ yêu cầu ESG/CSDDD từ buyer EU.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="facility" className="w-full">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full h-auto">
          <TabsTrigger value="facility"      className="text-xs"><Building2   className="w-3 h-3 mr-1" />1. Cơ sở</TabsTrigger>
          <TabsTrigger value="energy"        className="text-xs"><Zap         className="w-3 h-3 mr-1" />2. Năng lượng</TabsTrigger>
          <TabsTrigger value="processes"     className="text-xs"><Factory     className="w-3 h-3 mr-1" />3. Quy trình</TabsTrigger>
          <TabsTrigger value="materials"     className="text-xs"><Package2    className="w-3 h-3 mr-1" />4. Vật liệu</TabsTrigger>
          <TabsTrigger value="products"      className="text-xs"><FileBarChart className="w-3 h-3 mr-1" />5. Sản phẩm</TabsTrigger>
          <TabsTrigger value="communication" className="text-xs"><FileText    className="w-3 h-3 mr-1" />6. Truyền thông</TabsTrigger>
        </TabsList>

        {/* TAB 1 */}
        <TabsContent value="facility" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hồ sơ cơ sở (A_InstData)</CardTitle>
              <CardDescription>
                Thông tin cơ sở sản xuất, đầu mối chịu trách nhiệm và thị trường mục tiêu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <Row label="Tên doanh nghiệp"    value={company?.name ?? '—'}  source="companies.name" />
                  <Row label="Loại hình kinh doanh" value={company?.business_type ?? '—'} source="companies.business_type" />
                  <Row
                    label="Địa chỉ nhà máy"
                    value={company?.address ?? <span className="text-red-500 text-xs">Chưa cập nhật</span>}
                    source="companies.address"
                  />
                  <Row
                    label="Mã số thuế / EORI"
                    value={company?.tax_id ?? <span className="text-red-500 text-xs">Chưa cập nhật</span>}
                    source="companies.tax_id"
                  />
                  <Row label="Kỳ báo cáo"          value={<span className="font-semibold">{reportingPeriod}</span>} source="selected" />
                  <Row label="Từ ngày → Đến ngày"  value={`${periodStart} → ${periodEnd}`} source="computed" />
                  <Row label="Thị trường mục tiêu" value={(company?.target_markets ?? []).join(', ') || '—'} source="companies.target_markets" />
                </TableBody>
              </Table>
              {(!company?.address || !company?.tax_id) && (
                <p className="text-xs text-amber-700 mt-3">
                  Cập nhật địa chỉ và mã số thuế trong{' '}
                  <Link href="/settings" className="underline text-primary">Cài đặt</Link>{' '}
                  để hoàn chỉnh báo cáo.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="energy" className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Tổng điện tiêu thụ"        value={`${totals.totalKwh.toLocaleString()} kWh`} />
            <KpiCard label="Scope 1 (nhiên liệu)"       value={`${totals.scope1.toFixed(1)} kg CO₂e`} />
            <KpiCard label="Scope 2 (điện lưới)"        value={`${totals.scope2.toFixed(1)} kg CO₂e`} />
            <KpiCard
              label="Tổng phát thải cơ sở (S1+S2)"
              value={`${(totals.scope1 + totals.scope2).toFixed(1)} kg CO₂e`}
              sub={`Scope 3: ${totals.scope3.toFixed(1)} kg CO₂e`}
            />
          </div>

          {/* Electricity invoices */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Hóa đơn điện — Scope 2</CardTitle>
                  <CardDescription className="mt-0.5">Hệ số EVN từ Bộ TN&amp;MT 2024. Mỗi dòng truy vết về chứng từ gốc.</CardDescription>
                </div>
                <Link href="/evidence" className="shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" asChild={false}>
                    <Upload className="w-3 h-3" /> Tải chứng từ
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>Cơ sở</TableHead>
                    <TableHead>kWh</TableHead>
                    <TableHead>EF (kg/kWh)</TableHead>
                    <TableHead>CO₂e (kg)</TableHead>
                    <TableHead>Chứng từ</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {electricity.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">
                        Chưa có hóa đơn điện. Nhấn <strong>Thêm hóa đơn</strong> hoặc <strong>Tải chứng từ</strong> để bắt đầu.
                      </TableCell>
                    </TableRow>
                  )}
                  {electricity.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs font-medium">{e.billing_period ?? '—'}</TableCell>
                      <TableCell className="text-xs">{e.facility_name ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{Number(e.kwh).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{e.emission_factor_kg_per_kwh ?? 0.4290}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{(Number(e.scope2_co2e_kg) || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {e.evidence_document_id ? (
                          <Link href={`/evidence?highlight=${e.evidence_document_id}`} className="text-primary text-xs inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" />{e.status}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditElec(e)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteElec(e.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Fuel invoices */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Hóa đơn nhiên liệu — Scope 1</CardTitle>
                  <CardDescription className="mt-0.5">Than, gas, sinh khối… Hệ số DEFRA 2024 / IPCC 2006.</CardDescription>
                </div>
                <Link href="/evidence" className="shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1" asChild={false}>
                    <Upload className="w-3 h-3" /> Tải chứng từ
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>Loại NL</TableHead>
                    <TableHead>Lượng (L)</TableHead>
                    <TableHead>EF (kg/L)</TableHead>
                    <TableHead>CO₂e (kg)</TableHead>
                    <TableHead>Chứng từ</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fuels.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">
                        Chưa có hóa đơn nhiên liệu. Nhấn <strong>Thêm hóa đơn</strong> hoặc <strong>Tải chứng từ</strong> để bắt đầu.
                      </TableCell>
                    </TableRow>
                  )}
                  {fuels.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs font-medium">{f.billing_period ?? '—'}</TableCell>
                      <TableCell className="text-xs">{f.fuel_type ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{Number(f.quantity_liters).toLocaleString()} L</TableCell>
                      <TableCell className="font-mono text-xs">{f.emission_factor_kg_per_liter ?? '—'}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{(Number(f.scope1_co2e_kg) || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {f.evidence_document_id ? (
                          <Link href={`/evidence?highlight=${f.evidence_document_id}`} className="text-primary text-xs inline-flex items-center gap-1">
                            <Link2 className="w-3 h-3" />{f.status}
                          </Link>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditFuel(f)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteFuel(f.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3 */}
        <TabsContent value="processes" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Phân rã quy trình sản xuất (D_Processes)</CardTitle>
              <CardDescription>
                Quy trình điển hình ngành dệt may — hệ số từ SAC Higg FEM + Ecoinvent v3.10.
                Tải nhật ký sản xuất (<code>process_log</code>) để thay thế hệ số mặc định bằng dữ liệu thực.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quy trình</TableHead>
                    <TableHead>Hệ số mặc định</TableHead>
                    <TableHead>SP khớp vật liệu</TableHead>
                    <TableHead>Công thức</TableHead>
                    <TableHead>Chứng từ quy trình</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TEXTILE_PROCESSES.map((proc) => {
                    const related = products.filter((p) =>
                      (p.materials ?? []).some((m) => m?.toLowerCase().includes(proc.key))
                    ).length;
                    return (
                      <TableRow key={proc.key}>
                        <TableCell className="text-sm font-medium">{proc.label}</TableCell>
                        <TableCell className="font-mono text-xs">{proc.defaultFactor} {proc.unit}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {related > 0 ? `${related} SKU` : <span className="text-slate-400">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">Khối lượng × Hệ số × EF điện</TableCell>
                        <TableCell>
                          <EvidenceBadge status={evidenceByKind['process_log']?.[0]?.status ?? 'missing'} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground mt-3">
                <Link href="/evidence" className="text-primary underline">Tải chứng từ nhật ký sản xuất</Link>{' '}
                để thay thế hệ số mặc định.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4 */}
        <TabsContent value="materials" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vật liệu &amp; nhà cung ứng (E_PurchPrec)</CardTitle>
              <CardDescription>BOM, sợi, vải, phụ liệu, bao bì — Scope 3 đầu vào. Ecoinvent v3.10.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Vật liệu</TableHead>
                    <TableHead>Khối lượng</TableHead>
                    <TableHead>EF nguồn</TableHead>
                    <TableHead>Công thức</TableHead>
                    <TableHead>Chứng từ BOM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground text-sm">
                        Chưa có sản phẩm.{' '}
                        <Link href="/products" className="text-primary underline">Tạo sản phẩm</Link>
                      </TableCell>
                    </TableRow>
                  )}
                  {products.slice(0, 20).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">
                        <Link href="/products" className="text-primary inline-flex items-center gap-1">
                          {p.sku} <ExternalLink className="w-3 h-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{(p.materials ?? []).join(' · ')}</TableCell>
                      <TableCell className="font-mono text-xs">{p.weight ?? 0} kg</TableCell>
                      <TableCell className="text-xs text-muted-foreground">Ecoinvent v3.10</TableCell>
                      <TableCell className="text-xs text-muted-foreground">kg × EF vật liệu × Energy factor</TableCell>
                      <TableCell>
                        <EvidenceBadge
                          status={
                            evidenceByKind['bom']?.[0]?.status ??
                            evidenceByKind['supplier_doc']?.[0]?.status ??
                            'missing'
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5 */}
        <TabsContent value="products" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tổng hợp phát thải theo SKU (Summary_Products)</CardTitle>
              <CardDescription>
                <span className="text-blue-700 font-medium">Embedded Emissions (tCO₂e/tấn SP)</span> — chỉ số cốt lõi CBAM, chỉ tính phát thải trực tiếp từ sản xuất.
                Direct = Scope 1+2 phân bổ theo SP · Indirect = Scope 3 (nguyên liệu + vận chuyển + đóng gói).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Khối lượng</TableHead>
                    <TableHead>Direct (kg)</TableHead>
                    <TableHead>Indirect (kg)</TableHead>
                    <TableHead>Tổng CO₂e (kg)</TableHead>
                    <TableHead className="text-blue-700">Embedded (tCO₂e/tấn)</TableHead>
                    <TableHead>% Proxy</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Nguồn</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSummary.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground text-sm">
                        Chưa có sản phẩm.
                      </TableCell>
                    </TableRow>
                  )}
                  {productSummary.slice(0, 30).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">{p.sku}</TableCell>
                      <TableCell className="font-mono text-xs">{p.weight} kg</TableCell>
                      <TableCell className="font-mono text-xs">{p.direct.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.indirect.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold">{p.total.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-blue-700">
                        {p.embeddedPerTonne != null ? p.embeddedPerTonne.toFixed(4) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={p.proxyPct > 50 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}
                        >
                          {p.proxyPct}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            p.confidence >= 75 ? 'bg-emerald-100 text-emerald-700'
                            : p.confidence >= 50 ? 'bg-amber-100 text-amber-700'
                            : 'bg-red-100 text-red-700'
                          }
                        >
                          {p.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs p-1" onClick={() => router.push('/products')}>
                          {p.hasCalc
                            ? <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 cursor-pointer">Tính toán thực</Badge>
                            : <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 cursor-pointer">Proxy</Badge>
                          }
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {productSummary.some((p) => !p.hasCalc) && (
                <p className="text-xs text-amber-700 mt-3">
                  Một số SKU dùng hệ số proxy — chạy{' '}
                  <Link href="/carbon-calculator" className="underline text-primary">Carbon Calculator</Link>{' '}
                  để có tính toán Embedded Emissions chính xác.
                </p>
              )}
              {productSummary.some((p) => p.embeddedPerTonne == null) && (
                <p className="text-xs text-red-600 mt-2">
                  {productSummary.filter((p) => p.embeddedPerTonne == null).length} SKU hiển thị{' '}
                  <strong>—</strong> ở cột Embedded vì chưa có khối lượng sản phẩm.
                  Cập nhật trường <em>Khối lượng (kg)</em> tại{' '}
                  <Link href="/products" className="underline text-primary">trang Sản phẩm</Link>{' '}
                  để tính được chỉ số CBAM này.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6 */}
        <TabsContent value="communication" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bản tóm tắt cho buyer (Summary_Communication)</CardTitle>
              <CardDescription>
                Phiên bản gọn dành cho EU buyer / đơn vị thẩm tra.
                Nhấn <strong>Xuất XLSX</strong> ở đầu trang để tải file gửi buyer.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Section title="Thông tin cơ sở">
                <p>{company?.name ?? '—'} · {company?.business_type ?? '—'}</p>
                <p className="text-xs text-muted-foreground">
                  {company?.address
                    ? <span>Địa chỉ: {company.address} · </span>
                    : <span className="text-red-500">Địa chỉ: Chưa cập nhật · </span>
                  }
                  {company?.tax_id
                    ? <span>MST: {company.tax_id}</span>
                    : <span className="text-red-500">MST / EORI: Chưa cập nhật</span>
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  Kỳ báo cáo: {reportingPeriod} ({periodStart} → {periodEnd}) ·
                  Thị trường: {(company?.target_markets ?? []).join(', ') || '—'}
                </p>
              </Section>

              <Section title="Tổng phát thải (kg CO₂e)">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <Stat label="Scope 1 (trực tiếp)"      value={`${totals.scope1.toFixed(1)} kg`} />
                  <Stat label="Scope 2 (điện gián tiếp)" value={`${totals.scope2.toFixed(1)} kg`} />
                  <Stat label="Scope 3 (chuỗi cung ứng)" value={`${totals.scope3.toFixed(1)} kg`} />
                  <Stat label="Tổng"                      value={`${totals.total.toFixed(1)} kg`} />
                </div>
              </Section>

              <Section title="Embedded Emissions theo SKU (chỉ số CBAM)">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                  {productSummary.slice(0, 6).map((p) => (
                    <div key={p.id} className="p-2 rounded border bg-muted/30">
                      <p className="text-[10px] text-muted-foreground">{p.sku}</p>
                      <p className="font-mono font-semibold text-blue-700">
                        {p.embeddedPerTonne != null ? `${p.embeddedPerTonne.toFixed(4)} tCO₂e/tấn` : 'N/A'}
                      </p>
                    </div>
                  ))}
                  {productSummary.length === 0 && (
                    <p className="text-muted-foreground col-span-3">Chưa có sản phẩm.</p>
                  )}
                </div>
              </Section>

              <Section title="Dữ liệu sản phẩm">
                <p className="text-xs">
                  {products.length} SKU ·{' '}
                  {productSummary.filter((p) => p.confidence >= 75).length} SKU đạt confidence ≥ 75% ·{' '}
                  {productSummary.filter((p) => p.hasCalc).length} SKU có tính toán thực (không proxy)
                </p>
              </Section>

              <Section title="Tình trạng chứng từ">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(evidenceByKind).map(([k, list]) => (
                    <Badge key={k} variant="outline" className="text-[10px]">{k}: {list.length}</Badge>
                  ))}
                  {Object.keys(evidenceByKind).length === 0 && (
                    <span className="text-muted-foreground text-xs">Chưa có chứng từ.</span>
                  )}
                </div>
              </Section>

              <Section title="Khoảng trống dữ liệu">
                <ul className="text-xs list-disc pl-5 space-y-1">
                  {electricity.length === 0      && <li>Thiếu hóa đơn điện kỳ hiện tại.</li>}
                  {fuels.length === 0            && <li>Thiếu hóa đơn nhiên liệu (Scope 1).</li>}
                  {!company?.address             && <li>Thiếu địa chỉ nhà máy.</li>}
                  {!company?.tax_id              && <li>Thiếu mã số thuế / EORI.</li>}
                  {productSummary.filter((p) => p.proxyPct > 50).length > 0 && (
                    <li>{productSummary.filter((p) => p.proxyPct > 50).length} SKU đang dùng proxy &gt; 50%.</li>
                  )}
                  {productSummary.filter((p) => !p.hasCalc).length > 0 && (
                    <li>{productSummary.filter((p) => !p.hasCalc).length} SKU chưa có carbon calculation thực.</li>
                  )}
                  {checks.pct === 100 && (
                    <li className="text-emerald-700 list-none flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Không phát hiện thiếu sót lớn.
                    </li>
                  )}
                </ul>
              </Section>

              <Alert className="border-amber-300 bg-amber-50">
                <ShieldAlert className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-900 text-sm">Disclaimer</AlertTitle>
                <AlertDescription className="text-amber-800 text-xs">
                  This report is a pre-audit export carbon data report. It is not a CBAM declaration,
                  not a certification, and requires third-party verification for official use.
                  Textile goods are currently outside CBAM scope (Regulation EU 2023/956).
                  Structure follows DG TAXUD communication template for preparedness purposes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Electricity invoice modal (Add / Edit) ────────────────────────── */}
      <Dialog open={elecModalOpen} onOpenChange={setElecModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{elecEditing ? 'Sửa hóa đơn điện' : 'Thêm hóa đơn điện'}</DialogTitle>
            <DialogDescription className="text-xs">Dữ liệu sẽ tính tự động CO₂e (Scope 2) = kWh × EF</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kỳ thanh toán *</Label>
                <Input placeholder="2024-Q2 hoặc 2024-05" value={elecForm.billing_period}
                  onChange={(e) => setElecForm((f) => ({ ...f, billing_period: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cơ sở / Nhà máy</Label>
                <Input placeholder="Main Facility" value={elecForm.facility_name}
                  onChange={(e) => setElecForm((f) => ({ ...f, facility_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lượng điện (kWh) *</Label>
                <Input type="number" placeholder="12500" value={elecForm.kwh}
                  onChange={(e) => setElecForm((f) => ({ ...f, kwh: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Hệ số EF (kg CO₂e/kWh)</Label>
                <Input type="number" step="0.0001" value={elecForm.emission_factor_kg_per_kwh}
                  onChange={(e) => setElecForm((f) => ({ ...f, emission_factor_kg_per_kwh: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nguồn hệ số phát thải</Label>
              <Input value={elecForm.emission_factor_source}
                onChange={(e) => setElecForm((f) => ({ ...f, emission_factor_source: e.target.value }))} />
            </div>
            {elecForm.kwh && elecForm.emission_factor_kg_per_kwh && (
              <p className="text-xs text-emerald-700 bg-emerald-50 rounded p-2">
                CO₂e ≈ <strong>{(parseFloat(elecForm.kwh) * parseFloat(elecForm.emission_factor_kg_per_kwh)).toFixed(2)} kg</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setElecModalOpen(false)}>Huỷ</Button>
            <Button onClick={handleSaveElec} disabled={saving || !elecForm.billing_period || !elecForm.kwh}
              className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {elecEditing ? 'Lưu thay đổi' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Fuel invoice modal (Add / Edit) ──────────────────────────────── */}
      <Dialog open={fuelModalOpen} onOpenChange={setFuelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{fuelEditing ? 'Sửa hóa đơn nhiên liệu' : 'Thêm hóa đơn nhiên liệu'}</DialogTitle>
            <DialogDescription className="text-xs">Để trống EF → hệ thống dùng hệ số chuẩn theo loại nhiên liệu (DEFRA 2024)</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kỳ thanh toán *</Label>
                <Input placeholder="2024-Q2 hoặc 2024-05" value={fuelForm.billing_period}
                  onChange={(e) => setFuelForm((f) => ({ ...f, billing_period: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Loại nhiên liệu</Label>
                <Select value={fuelForm.fuel_type} onValueChange={(v) => setFuelForm((f) => ({ ...f, fuel_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[['diesel','Diesel (2.688)'],['petrol','Xăng / Petrol (2.352)'],['lpg','LPG (1.629)'],['cng','CNG (2.740)'],['coal','Than đá / Coal (2.420)'],['biomass','Sinh khối / Biomass (0)'],['other','Khác (2.500)']].map(([v,l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Lượng (lít) *</Label>
                <Input type="number" placeholder="500" value={fuelForm.quantity_liters}
                  onChange={(e) => setFuelForm((f) => ({ ...f, quantity_liters: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">EF tùy chỉnh (kg/lít) <span className="text-slate-400 font-normal">(tuỳ chọn)</span></Label>
                <Input type="number" step="0.0001" placeholder="Tự động từ loại NL" value={fuelForm.emission_factor_kg_per_liter}
                  onChange={(e) => setFuelForm((f) => ({ ...f, emission_factor_kg_per_liter: e.target.value }))} />
              </div>
            </div>
            {fuelForm.quantity_liters && (() => {
              const EF_MAP: Record<string,number> = { diesel:2.688, petrol:2.352, lpg:1.629, cng:2.740, coal:2.420, biomass:0, other:2.500 };
              const ef = fuelForm.emission_factor_kg_per_liter ? parseFloat(fuelForm.emission_factor_kg_per_liter) : (EF_MAP[fuelForm.fuel_type] ?? 2.5);
              const co2e = parseFloat(fuelForm.quantity_liters) * ef;
              return <p className="text-xs text-orange-700 bg-orange-50 rounded p-2">CO₂e ≈ <strong>{co2e.toFixed(2)} kg</strong> ({parseFloat(fuelForm.quantity_liters).toLocaleString()} L × {ef} kg/L)</p>;
            })()}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFuelModalOpen(false)}>Huỷ</Button>
            <Button onClick={handleSaveFuel} disabled={saving || !fuelForm.billing_period || !fuelForm.quantity_liters}
              className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {fuelEditing ? 'Lưu thay đổi' : 'Thêm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
