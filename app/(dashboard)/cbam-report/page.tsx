'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Building2,
  ExternalLink,
  Factory,
  FileBarChart,
  FileText,
  Link2,
  Package2,
  ShieldAlert,
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
}

interface FuelInvoice {
  id: string;
  billing_period: string;
  fuel_type: string;
  quantity_liters: number;
  emission_factor_kg_per_liter: number | null;
  scope1_co2e_kg: number | null;
  status: string;
}

interface EvidenceDoc {
  id: string;
  kind: string | null;
  status: string | null;
}

interface CarbonCalc {
  id: string;
  product_id: string | null;
  total_co2e: number;
  materials_co2e: number | null;
  production_co2e: number | null;
  transport_co2e: number | null;
  packaging_co2e: number | null;
}

interface CompanyData {
  name: string;
  business_type: string | null;
  target_markets: string[] | null;
}

// Aligned with factorRegistry.ts — SAC Higg FEM + BREF Textile BAT 2017
const TEXTILE_PROCESSES = [
  { key: 'knitting',  label: 'Dệt kim (Knitting)',       defaultFactor: 1.8,  unit: 'kWh/kg' },
  { key: 'weaving',   label: 'Dệt thoi (Weaving)',        defaultFactor: 2.2,  unit: 'kWh/kg' },
  { key: 'dyeing',    label: 'Nhuộm (Dyeing)',            defaultFactor: 5.5,  unit: 'kWh/kg' },
  { key: 'printing',  label: 'In (Printing)',             defaultFactor: 2.5,  unit: 'kWh/kg' },
  { key: 'cutting',   label: 'Cắt & May (Cutting/Sewing)', defaultFactor: 1.2, unit: 'kWh/kg' },
  { key: 'washing',   label: 'Giặt (Washing)',            defaultFactor: 2.0,  unit: 'kWh/kg' },
  { key: 'finishing', label: 'Hoàn tất (Finishing)',      defaultFactor: 1.5,  unit: 'kWh/kg' },
  { key: 'packaging', label: 'Đóng gói (Packaging)',      defaultFactor: 0.3,  unit: 'kWh/kg' },
];

const EVIDENCE_BADGE: Record<string, { label: string; className: string }> = {
  verified: { label: 'Đã xác minh', className: 'bg-emerald-100 text-emerald-700' },
  cross_checked: { label: 'Đối chiếu chéo', className: 'bg-sky-100 text-sky-700' },
  source_matched: { label: 'Khớp nguồn', className: 'bg-sky-100 text-sky-700' },
  ocr_parsed: { label: 'AI đọc', className: 'bg-amber-100 text-amber-700' },
  uploaded: { label: 'Đã tải lên', className: 'bg-amber-100 text-amber-700' },
  pending: { label: 'Chờ xử lý', className: 'bg-slate-100 text-slate-700' },
  missing: { label: 'Thiếu chứng từ', className: 'bg-red-100 text-red-700' },
};

function EvidenceBadge({ status }: { status?: string | null }) {
  const meta = EVIDENCE_BADGE[status ?? 'missing'] ?? EVIDENCE_BADGE.missing;
  return (
    <Badge variant="secondary" className={meta.className}>
      {meta.label}
    </Badge>
  );
}

const Row: React.FC<{
  label: string;
  value: React.ReactNode;
  source: string;
}> = ({ label, value, source }) => (
  <TableRow>
    <TableCell className="text-xs text-muted-foreground w-1/3">
      {label}
    </TableCell>
    <TableCell className="text-sm font-medium">{value}</TableCell>
    <TableCell className="text-[11px] text-muted-foreground text-right">
      {source}
    </TableCell>
  </TableRow>
);

const KpiCard: React.FC<{ label: string; value: string; link?: string }> = ({
  label,
  value,
  link,
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription className="text-xs">{label}</CardDescription>
      <CardTitle className="text-lg font-bold">{value}</CardTitle>
    </CardHeader>
    {link && (
      <CardContent className="pt-0">
        <Link
          href={link}
          className="text-xs text-primary inline-flex items-center gap-1"
        >
          <Link2 className="w-3 h-3" />
          Xem chứng từ
        </Link>
      </CardContent>
    )}
  </Card>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
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

export default function CbamReportPage() {
  const { products } = useProducts();
  const router = useRouter();
  const { setPageTitle } = useDashboardTitle();

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [electricity, setElectricity] = useState<ElectricityInvoice[]>([]);
  const [fuels, setFuels] = useState<FuelInvoice[]>([]);
  const [evidence, setEvidence] = useState<EvidenceDoc[]>([]);
  const [calcs, setCalcs] = useState<CarbonCalc[]>([]);

  const reportingPeriod = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()} Q${Math.floor(now.getMonth() / 3) + 1}`;
  }, []);

  useEffect(() => {
    setPageTitle('Báo cáo CBAM-style', 'Cấu trúc 6 tab phỏng theo EU CBAM communication template.');
  }, [setPageTitle]);

  useEffect(() => {
    api.get<{ company?: CompanyData }>('/account')
      .then((res) => { if (res?.company) setCompany(res.company); })
      .catch(() => {});

    Promise.allSettled([
      api.get<ElectricityInvoice[]>('/electricity-invoices'),
      api.get<FuelInvoice[]>('/fuel-invoices'),
      api.get<{ items?: EvidenceDoc[] } | EvidenceDoc[]>('/evidence?page=1&page_size=100'),
      api.get<CarbonCalc[]>('/carbon-calculations'),
    ]).then(([e, f, ev, k]) => {
      if (e.status === 'fulfilled') setElectricity(e.value ?? []);
      if (f.status === 'fulfilled') setFuels(f.value ?? []);
      if (ev.status === 'fulfilled') {
        const evData = ev.value;
        setEvidence(Array.isArray(evData) ? evData : (evData as { items?: EvidenceDoc[] }).items ?? []);
      }
      if (k.status === 'fulfilled') setCalcs(k.value ?? []);
    });
  }, []);

  const totals = useMemo(() => {
    const scope1 = fuels.reduce((s, f) => s + (f.scope1_co2e_kg ?? 0), 0);
    const scope2 = electricity.reduce(
      (s, e) => s + (e.scope2_co2e_kg ?? 0),
      0
    );
    const scope3 = products.reduce(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s, p: any) => s + (p.co2 ?? 0) * 0.7,
      0
    );
    const totalKwh = electricity.reduce((s, e) => s + (e.kwh ?? 0), 0);
    return { scope1, scope2, scope3, total: scope1 + scope2 + scope3, totalKwh };
  }, [fuels, electricity, products]);

  const evidenceByKind = useMemo(() => {
    const map: Record<string, EvidenceDoc[]> = {};
    for (const e of evidence) {
      const k = e.kind ?? 'other';
      (map[k] ??= []).push(e);
    }
    return map;
  }, [evidence]);

  const productSummary = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return products.map((p: any) => {
      const calc = calcs.find((c) => c.product_id === p.id);
      const total = calc?.total_co2e ?? p.co2 ?? 0;
      const s1 = (calc?.production_co2e ?? 0) * 0.2 || total * 0.05;
      const s2 = (calc?.production_co2e ?? 0) * 0.8 || total * 0.25;
      const s3 =
        (calc?.materials_co2e ?? 0) +
          (calc?.transport_co2e ?? 0) +
          (calc?.packaging_co2e ?? 0) ||
        total * 0.7;
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        weight: p.weight ?? 0,
        materials: p.materials ?? [],
        s1,
        s2,
        s3,
        total: s1 + s2 + s3,
        proxyPct: p.proxyPercentage ?? Math.max(0, 100 - (p.confidenceScore ?? 50)),
        confidence: p.confidenceScore ?? 50,
      };
    });
  }, [products, calcs]);

  return (
    <div className="flex-1 p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">
          Báo cáo carbon theo cấu trúc CBAM-style
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cấu trúc 6 tab phỏng theo EU CBAM communication template — áp dụng
          cho dệt may, da giày &amp; xuất khẩu.
        </p>
      </div>

      <Alert className="border-amber-300 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-700" />
        <AlertTitle className="text-amber-900">
          Báo cáo carbon tiền-thẩm tra (pre-audit)
        </AlertTitle>
        <AlertDescription className="text-amber-800 text-xs">
          Đây là báo cáo dữ liệu carbon phục vụ xuất khẩu ở mức tiền-thẩm
          tra. Không phải tờ khai CBAM, không phải chứng nhận, và cần đơn vị
          thẩm tra độc lập để sử dụng chính thức. Dệt may hiện chưa thuộc
          phạm vi CBAM chính thức — cấu trúc 6 tab chỉ phỏng theo mẫu DG
          TAXUD.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="facility" className="w-full">
        <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full h-auto">
          <TabsTrigger value="facility" className="text-xs">
            <Building2 className="w-3 h-3 mr-1" />
            1. Cơ sở
          </TabsTrigger>
          <TabsTrigger value="energy" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            2. Năng lượng
          </TabsTrigger>
          <TabsTrigger value="processes" className="text-xs">
            <Factory className="w-3 h-3 mr-1" />
            3. Quy trình
          </TabsTrigger>
          <TabsTrigger value="materials" className="text-xs">
            <Package2 className="w-3 h-3 mr-1" />
            4. Vật liệu
          </TabsTrigger>
          <TabsTrigger value="products" className="text-xs">
            <FileBarChart className="w-3 h-3 mr-1" />
            5. Sản phẩm
          </TabsTrigger>
          <TabsTrigger value="communication" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            6. Truyền thông
          </TabsTrigger>
        </TabsList>

        {/* TAB 1 */}
        <TabsContent value="facility" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Hồ sơ cơ sở (A_InstData)
              </CardTitle>
              <CardDescription>
                Thông tin cơ sở sản xuất, đầu mối chịu trách nhiệm và thị
                trường mục tiêu.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableBody>
                  <Row
                    label="Tên doanh nghiệp"
                    value={company?.name ?? '—'}
                    source="user input · companies.name"
                  />
                  <Row
                    label="Loại hình kinh doanh"
                    value={company?.business_type ?? '—'}
                    source="user input · companies.business_type"
                  />
                  <Row
                    label="Kỳ báo cáo"
                    value={reportingPeriod}
                    source="system · current quarter"
                  />
                  <Row
                    label="Thị trường mục tiêu"
                    value={
                      (company?.target_markets ?? []).join(', ') || '—'
                    }
                    source="user input · companies.target_markets"
                  />
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 */}
        <TabsContent value="energy" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <KpiCard
              label="Tổng điện tiêu thụ"
              value={`${totals.totalKwh.toLocaleString()} kWh`}
            />
            <KpiCard
              label="Scope 1 (nhiên liệu)"
              value={`${totals.scope1.toFixed(1)} kg CO₂e`}
              link="/evidence"
            />
            <KpiCard
              label="Scope 2 (điện lưới)"
              value={`${totals.scope2.toFixed(1)} kg CO₂e`}
              link="/evidence"
            />
            <KpiCard
              label="Tổng phát thải cơ sở"
              value={`${(totals.scope1 + totals.scope2).toFixed(1)} kg CO₂e`}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hóa đơn điện — Scope 2</CardTitle>
              <CardDescription>
                Hệ số EVN từ Bộ TN&amp;MT 2024. Mỗi dòng có thể truy vết về
                chứng từ gốc.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>kWh (Activity Data)</TableHead>
                    <TableHead>EF (kg/kWh)</TableHead>
                    <TableHead>Công thức</TableHead>
                    <TableHead>CO₂e</TableHead>
                    <TableHead>Chứng từ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {electricity.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground text-sm"
                      >
                        Chưa có hóa đơn điện.{' '}
                        <Link
                          href="/evidence"
                          className="text-primary underline"
                        >
                          Tải chứng từ
                        </Link>
                      </TableCell>
                    </TableRow>
                  )}
                  {electricity.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">
                        {e.billing_period ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.kwh ?? 0}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.emission_factor_kg_per_kwh ?? 0.6766}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        kWh × EF · {e.emission_factor_source ?? 'EVN 2024'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {(e.scope2_co2e_kg ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href="/evidence"
                          className="text-primary text-xs inline-flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" />
                          {e.status}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Hóa đơn nhiên liệu — Scope 1
              </CardTitle>
              <CardDescription>
                Than, gas, sinh khối… Hệ số DEFRA 2024 / IPCC 2006.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kỳ</TableHead>
                    <TableHead>Loại</TableHead>
                    <TableHead>Lượng</TableHead>
                    <TableHead>EF</TableHead>
                    <TableHead>Công thức</TableHead>
                    <TableHead>CO₂e</TableHead>
                    <TableHead>Chứng từ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fuels.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground text-sm"
                      >
                        Chưa có hóa đơn nhiên liệu.{' '}
                        <Link
                          href="/evidence"
                          className="text-primary underline"
                        >
                          Tải chứng từ
                        </Link>
                      </TableCell>
                    </TableRow>
                  )}
                  {fuels.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs">
                        {f.billing_period ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {f.fuel_type ?? '—'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.quantity_liters ?? 0} L
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {f.emission_factor_kg_per_liter ?? 0}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        L × EF
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {(f.scope1_co2e_kg ?? 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Link
                          href="/evidence"
                          className="text-primary text-xs inline-flex items-center gap-1"
                        >
                          <Link2 className="w-3 h-3" />
                          {f.status}
                        </Link>
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
              <CardTitle className="text-base">
                Phân rã quy trình sản xuất (D_Processes)
              </CardTitle>
              <CardDescription>
                Quy trình điển hình ngành dệt may. Hệ số tiêu hao điện áp dụng
                từ Ecoinvent v3.10.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quy trình</TableHead>
                    <TableHead>Hệ số mặc định</TableHead>
                    <TableHead>SP liên quan</TableHead>
                    <TableHead>Công thức</TableHead>
                    <TableHead>Chứng từ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TEXTILE_PROCESSES.map((proc) => {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const related = products.filter((p: any) =>
                      (p.materials ?? []).some(
                        (m: string) =>
                          m?.toLowerCase().includes(proc.key) ||
                          proc.key === 'cutting'
                      )
                    ).length;
                    return (
                      <TableRow key={proc.key}>
                        <TableCell className="text-sm font-medium">
                          {proc.label}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {proc.defaultFactor} {proc.unit}
                        </TableCell>
                        <TableCell className="text-xs">
                          {related} SKU
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          Khối lượng × Hệ số × EF điện
                        </TableCell>
                        <TableCell>
                          <EvidenceBadge
                            status={
                              evidenceByKind['process_log']?.[0]?.status ??
                              'missing'
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4 */}
        <TabsContent value="materials" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Vật liệu &amp; nhà cung ứng (E_PurchPrec)
              </CardTitle>
              <CardDescription>
                BOM, sợi, vải, phụ liệu, bao bì — coi là Scope 3 đầu vào.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SP / SKU</TableHead>
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
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground text-sm"
                      >
                        Chưa có sản phẩm.{' '}
                        <Link
                          href="/products"
                          className="text-primary underline"
                        >
                          Tạo sản phẩm
                        </Link>
                      </TableCell>
                    </TableRow>
                  )}
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {products.slice(0, 20).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">
                        <Link
                          href="/products"
                          className="text-primary inline-flex items-center gap-1"
                        >
                          {p.sku} <ExternalLink className="w-3 h-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {(p.materials ?? []).join(' · ')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.weight ?? 0} kg
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        Ecoinvent v3.10
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        kg × EF vật liệu × Energy factor
                      </TableCell>
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
              <CardTitle className="text-base">
                Tổng hợp theo SKU (Summary_Products)
              </CardTitle>
              <CardDescription>
                Mỗi SKU thể hiện Scope 1/2/3, CO₂e/đơn vị, % proxy và
                confidence.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Khối lượng</TableHead>
                    <TableHead>Vật liệu</TableHead>
                    <TableHead>S1</TableHead>
                    <TableHead>S2</TableHead>
                    <TableHead>S3</TableHead>
                    <TableHead>Tổng</TableHead>
                    <TableHead>kg CO₂e/đơn vị</TableHead>
                    <TableHead>% Proxy</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Chi tiết</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSummary.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center text-muted-foreground text-sm"
                      >
                        Chưa có sản phẩm.
                      </TableCell>
                    </TableRow>
                  )}
                  {productSummary.slice(0, 30).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-medium">
                        {p.sku}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.weight} kg
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.materials.join(', ')}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.s1.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.s2.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.s3.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {p.total.toFixed(2)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.weight > 0
                          ? (p.total / p.weight).toFixed(2)
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            p.proxyPct > 50
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }
                        >
                          {p.proxyPct}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            p.confidence >= 75
                              ? 'bg-emerald-100 text-emerald-700'
                              : p.confidence >= 50
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                          }
                        >
                          {p.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => router.push('/products')}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Mở
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6 */}
        <TabsContent value="communication" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Bản tóm tắt cho buyer (Summary_Communication)
              </CardTitle>
              <CardDescription>
                Phiên bản gọn dành cho khách hàng / đơn vị thẩm tra.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Section title="Thông tin cơ sở">
                <p>
                  {company?.name ?? '—'} · {company?.business_type ?? '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Kỳ báo cáo: {reportingPeriod} · Thị trường:{' '}
                  {(company?.target_markets ?? []).join(', ') || '—'}
                </p>
              </Section>
              <Section title="Tổng phát thải">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <Stat
                    label="Scope 1"
                    value={`${totals.scope1.toFixed(1)} kg`}
                  />
                  <Stat
                    label="Scope 2"
                    value={`${totals.scope2.toFixed(1)} kg`}
                  />
                  <Stat
                    label="Scope 3"
                    value={`${totals.scope3.toFixed(1)} kg`}
                  />
                  <Stat
                    label="Tổng"
                    value={`${totals.total.toFixed(1)} kg`}
                  />
                </div>
              </Section>
              <Section title="Dữ liệu sản phẩm">
                <p className="text-xs">
                  {products.length} SKU ·{' '}
                  {productSummary.filter((p) => p.confidence >= 75).length}{' '}
                  SKU đạt confidence ≥ 75%
                </p>
              </Section>
              <Section title="Tình trạng chứng từ">
                <div className="flex flex-wrap gap-2 text-xs">
                  {Object.entries(evidenceByKind).map(([k, list]) => (
                    <Badge key={k} variant="outline" className="text-[10px]">
                      {k}: {list.length}
                    </Badge>
                  ))}
                  {Object.keys(evidenceByKind).length === 0 && (
                    <span className="text-muted-foreground">
                      Chưa có chứng từ.
                    </span>
                  )}
                </div>
              </Section>
              <Section title="Khoảng trống dữ liệu">
                <ul className="text-xs list-disc pl-5 space-y-1">
                  {electricity.length === 0 && (
                    <li>Thiếu hóa đơn điện kỳ hiện tại.</li>
                  )}
                  {fuels.length === 0 && (
                    <li>Thiếu hóa đơn nhiên liệu (Scope 1).</li>
                  )}
                  {productSummary.filter((p) => p.proxyPct > 50).length >
                    0 && (
                    <li>
                      {productSummary.filter((p) => p.proxyPct > 50).length}{' '}
                      SKU đang dùng proxy &gt; 50%.
                    </li>
                  )}
                  {electricity.length > 0 &&
                    fuels.length > 0 &&
                    productSummary.every((p) => p.proxyPct <= 50) && (
                      <li>Không phát hiện thiếu sót lớn.</li>
                    )}
                </ul>
              </Section>
              <Alert className="border-amber-300 bg-amber-50">
                <ShieldAlert className="h-4 w-4 text-amber-700" />
                <AlertTitle className="text-amber-900 text-sm">
                  Disclaimer
                </AlertTitle>
                <AlertDescription className="text-amber-800 text-xs">
                  This report is a pre-audit export carbon data report. It is
                  not a CBAM declaration, not a certification, and requires
                  third-party verification for official use.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
