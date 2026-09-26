'use client';

import { useState } from 'react';
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Calculator,
  CheckCircle2,
  Factory,
  Info,
  Leaf,
  Loader2,
  Package,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import ReactMarkdown from 'react-markdown';
import { getCarbonFactor, resolveCategoryMethodology } from '@/lib/carbon/factorRegistry';
import type { ProductCategory } from '@/lib/carbon/types';

// Sourced from lib/carbon/factorRegistry.ts (same registry the assessment engine uses),
// so this quick calculator stops maintaining its own drifting copy of emission factors.
const MATERIAL_OPTIONS_BY_CATEGORY: Record<ProductCategory, { value: string; label: string }[]> = {
  textile: [
    { value: 'cat-cotton-100', label: 'Cotton thông thường' },
    { value: 'cat-polyester-100', label: 'Polyester nguyên sinh' },
    { value: 'cat-wool-100', label: 'Len' },
    { value: 'cat-silk-100', label: 'Lụa tơ tằm' },
    { value: 'cat-linen-100', label: 'Linen' },
    { value: 'cat-polyester-recycled', label: 'Polyester tái chế' },
    { value: 'cat-cotton-organic', label: 'Cotton hữu cơ' },
    { value: 'cat-hemp', label: 'Hemp' },
  ],
};

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  textile: 'Dệt may',
};

const GRID_EMISSION_FACTOR = getCarbonFactor('energy-grid-vn-2023')?.value ?? 0.6592;
const PACKAGING_FACTOR = getCarbonFactor('packaging-minimal-proxy')?.value ?? 0.3;
// DEFRA sea-freight factor is per tonne.km; the calculator works in kg.km.
const TRANSPORT_FACTOR = (getCarbonFactor('transport-sea-defra-2025')?.value ?? 16.12) / 1000;

const resolveManufacturingFactor = (category: ProductCategory) => {
  const processFactorId = resolveCategoryMethodology(category).defaultProcessFactorId;
  const processIntensityKwhPerKg = getCarbonFactor(processFactorId)?.value ?? 0;
  return processIntensityKwhPerKg * GRID_EMISSION_FACTOR;
};

interface EmissionBreakdown {
  material: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
  biogenic: number;
}

const DESTINATION_OPTIONS = [
  { value: 'japan', label: 'Nhật Bản', distanceKm: 3800 },
  { value: 'korea', label: 'Hàn Quốc', distanceKm: 3200 },
  { value: 'china', label: 'Trung Quốc', distanceKm: 1800 },
  { value: 'asean', label: 'ASEAN', distanceKm: 1500 },
  { value: 'eu', label: 'Liên minh Châu Âu (EU)', distanceKm: 15000 },
  { value: 'us', label: 'Hoa Kỳ (US)', distanceKm: 12500 },
  { value: 'uk', label: 'Vương quốc Anh (UK)', distanceKm: 14500 },
  { value: 'australia', label: 'Úc (Australia)', distanceKm: 6800 },
  { value: 'domestic', label: 'Nội địa Việt Nam', distanceKm: 500 },
] as const;

const BREAKDOWN_META = [
  { key: 'material', icon: Leaf, label: 'Vật liệu nguyên liệu', color: 'text-emerald-600', badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'manufacturing', icon: Factory, label: 'Sản xuất & Chế biến', color: 'text-sky-600', badgeBg: 'bg-sky-50 text-sky-700 border-sky-200' },
  { key: 'transport', icon: Truck, label: 'Vận chuyển xuất khẩu', color: 'text-amber-600', badgeBg: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'packaging', icon: Package, label: 'Đóng gói bao bì', color: 'text-purple-600', badgeBg: 'bg-purple-50 text-purple-700 border-purple-200' },
] as const;

const pct = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

const getDestinationLabel = (value: string) =>
  DESTINATION_OPTIONS.find((option) => option.value === value)?.label ?? value;

function buildAssessmentPrompt(context: {
  category: ProductCategory;
  weight: string;
  material: string;
  destination: string;
  transportDistance: string;
  emissions: EmissionBreakdown;
}): string {
  const materialFactorMeta = getCarbonFactor(context.material);
  const materialLabel = materialFactorMeta?.label ?? context.material;
  const destinationLabel = getDestinationLabel(context.destination);
  const manufacturingFactor = resolveManufacturingFactor(context.category);

  const biogenicLine = context.emissions.biogenic > 0
    ? `\n- Carbon sinh học lưu trữ (biogenic, không cộng vào tổng): ${context.emissions.biogenic.toFixed(2)} kg CO2`
    : '';

  return `Bạn là chuyên gia tư vấn carbon footprint cho sản phẩm ngành ${CATEGORY_LABELS[context.category]}.

Hãy đánh giá ngắn gọn kết quả tính carbon proxy dưới đây bằng tiếng Việt, tập trung vào quyết định vận hành:
- Nêu nhận định chính về mức phát thải và nhóm đóng góp lớn nhất.
- Chỉ ra 2-3 nguyên nhân có khả năng làm phát thải cao.
- Đề xuất 3 hành động giảm phát thải theo thứ tự ưu tiên.
- Nêu rõ đây là ước tính proxy, không thay thế dữ liệu sơ cấp/audit.
- Trả lời có cấu trúc, thực tế, không hỏi lại người dùng.

Dữ liệu đầu vào:
- Khối lượng sản phẩm: ${context.weight} kg
- Vật liệu chính: ${materialLabel}
- Hệ số vật liệu: ${materialFactorMeta?.value ?? 0} kg CO2e/kg
- Điểm đến vận chuyển: ${destinationLabel}
- Khoảng cách vận chuyển: ${context.transportDistance} km
- Hệ số vận chuyển proxy: ${TRANSPORT_FACTOR} kg CO2e/kg.km
- Hệ số sản xuất proxy: ${manufacturingFactor.toFixed(4)} kg CO2e/kg
- Hệ số đóng gói proxy: ${PACKAGING_FACTOR} kg CO2e/kg

Kết quả:
- Tổng phát thải: ${context.emissions.total.toFixed(2)} kg CO2e/sản phẩm
- Vật liệu: ${context.emissions.material.toFixed(2)} kg CO2e (${pct(context.emissions.material, context.emissions.total).toFixed(0)}%)
- Sản xuất: ${context.emissions.manufacturing.toFixed(2)} kg CO2e (${pct(context.emissions.manufacturing, context.emissions.total).toFixed(0)}%)
- Vận chuyển: ${context.emissions.transport.toFixed(2)} kg CO2e (${pct(context.emissions.transport, context.emissions.total).toFixed(0)}%)
- Đóng gói: ${context.emissions.packaging.toFixed(2)} kg CO2e (${pct(context.emissions.packaging, context.emissions.total).toFixed(0)}%)${biogenicLine}`;
}

export default function CarbonCalculator() {
  const [category, setCategory] = useState<ProductCategory>('textile');
  const [weight, setWeight] = useState('');
  const [material, setMaterial] = useState('');
  const [destination, setDestination] = useState('');
  const [transportDistance, setTransportDistance] = useState('');
  const [emissions, setEmissions] = useState<EmissionBreakdown | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const materialOptions = MATERIAL_OPTIONS_BY_CATEGORY[category];

  const resetDerivedState = () => {
    setEmissions(null);
    setAssessment(null);
    setAssessmentError(null);
  };

  const handleCategoryChange = (value: ProductCategory) => {
    setCategory(value);
    setMaterial('');
    resetDerivedState();
  };

  const calculate = () => {
    if (!weight || !material || !destination || !transportDistance) return;

    const kg = parseFloat(weight);
    const distanceKm = parseFloat(transportDistance);
    if (Number.isNaN(kg) || kg <= 0 || Number.isNaN(distanceKm) || distanceKm <= 0) return;

    const materialFactorMeta = getCarbonFactor(material);
    const materialEmission = kg * (materialFactorMeta?.value ?? 0);
    const manufacturingEmission = kg * resolveManufacturingFactor(category);
    const transportEmission = kg * distanceKm * TRANSPORT_FACTOR;
    const packagingEmission = kg * PACKAGING_FACTOR;
    const biogenicEmission = kg * (materialFactorMeta?.biogenicCarbonKgPerKg ?? 0);
    const total =
      materialEmission +
      manufacturingEmission +
      transportEmission +
      packagingEmission;

    setEmissions({
      material: materialEmission,
      manufacturing: manufacturingEmission,
      transport: transportEmission,
      packaging: packagingEmission,
      total,
      biogenic: biogenicEmission,
    });
    setAssessment(null);
    setAssessmentError(null);
  };

  const canCalculate = Boolean(weight && material && destination && transportDistance);

  const requestAssessment = async () => {
    if (!emissions || isAssessing) return;

    setIsAssessing(true);
    setAssessmentError(null);
    setAssessment(null);

    try {
      const prompt = buildAssessmentPrompt({
        category,
        weight,
        material,
        destination,
        transportDistance,
        emissions,
      });
      const data = await api.post<{ answer?: string }>('/chat/direct', { query: prompt });
      if (!data.answer?.trim()) {
        throw new Error('AI không trả về nội dung đánh giá.');
      }

      setAssessment(data.answer.trim());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Không thể tạo đánh giá lúc này.';
      setAssessmentError(message);
    } finally {
      setIsAssessing(false);
    }
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:space-y-6 md:p-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-900">Tính Carbon Proxy</h1>
              <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                Scope 1 + 2 + 3 Upstream
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Ước tính nhanh phát thải CO₂e theo ngành hàng, tỷ trọng vật liệu, chế biến năng lượng và hành trình xuất khẩu.
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className="grid lg:grid-cols-2 gap-5 md:gap-6 items-start">
        {/* Input Form Card */}
        <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <CardHeader className="pb-3.5 border-b border-slate-100 bg-slate-50/40">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-800">
                <Calculator className="w-4 h-4" />
              </div>
              Nhập thông tin sản phẩm
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Hệ số tính toán được ánh xạ tự động từ cơ sở dữ liệu DEFRA 2025 và Higg MSI 3.0.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Ngành hàng</Label>
              <Select
                value={category}
                onValueChange={(value) => handleCategoryChange(value as ProductCategory)}
              >
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm font-medium focus:border-emerald-500 focus:ring-emerald-500/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value} className="text-sm font-medium">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weight" className="text-xs font-semibold text-slate-700">
                Khối lượng sản phẩm (kg)
              </Label>
              <div className="relative">
                <Input
                  id="weight"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.25"
                  value={weight}
                  onChange={(event) => {
                    setWeight(event.target.value);
                    resetDerivedState();
                  }}
                  className="h-10 rounded-xl border-slate-200 pr-10 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  kg
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Loại vật liệu chính</Label>
              <Select
                value={material}
                onValueChange={(value) => {
                  setMaterial(value);
                  resetDerivedState();
                }}
              >
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20">
                  <SelectValue placeholder="Chọn vật liệu" />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-800">{option.label}</span>
                        <span className="font-mono text-xs text-slate-500 ml-1">
                          ({getCarbonFactor(option.value)?.value ?? 0} kg CO₂e/kg)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Điểm đến xuất khẩu</Label>
                <Select
                  value={destination}
                  onValueChange={(value) => {
                    const selectedDestination = DESTINATION_OPTIONS.find(
                      (option) => option.value === value
                    );
                    setDestination(value);
                    setTransportDistance(
                      selectedDestination?.distanceKm.toString() ?? ''
                    );
                    resetDerivedState();
                  }}
                >
                  <SelectTrigger id="destination" className="h-10 rounded-xl border-slate-200 bg-white text-sm focus:border-emerald-500 focus:ring-emerald-500/20">
                    <SelectValue placeholder="Chọn thị trường đích" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-800">{option.label}</span>
                          <span className="font-mono text-xs text-slate-500 ml-1">
                            (~{option.distanceKm.toLocaleString('vi-VN')} km)
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transportDistance" className="text-xs font-semibold text-slate-700">
                  Khoảng cách vận chuyển (km)
                </Label>
                <div className="relative">
                  <Input
                    id="transportDistance"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="3800"
                    value={transportDistance}
                    onChange={(event) => {
                      setTransportDistance(event.target.value);
                      resetDerivedState();
                    }}
                    className="h-10 rounded-xl border-slate-200 pr-10 text-sm focus:border-emerald-500 focus:ring-emerald-500/20"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    km
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Hệ số vận chuyển đường biển quốc tế: <span className="font-mono text-slate-700">{TRANSPORT_FACTOR}</span> kg CO₂e/kg.km.
                </p>
              </div>
            </div>

            <Button
              className="h-10.5 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-50 mt-2"
              onClick={calculate}
              disabled={!canCalculate}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Tính toán phát thải
            </Button>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <span className="leading-relaxed">
                Hệ số phát thải được chuẩn hóa từ cơ sở dữ liệu proxy ngành. Với báo cáo kiểm toán CBAM chính thức, hãy bổ sung chứng từ sơ cấp trong mục Quản lý lô / Evidence.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Results Card */}
        <Card
          className={`rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden transition-all duration-300 ${
            emissions ? 'opacity-100' : 'opacity-85'
          }`}
        >
          <CardHeader className="pb-3.5 border-b border-slate-100 bg-slate-50/40">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100/70 text-emerald-800">
                <Leaf className="w-4 h-4" />
              </div>
              Kết quả tính toán
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Phân rã lượng phát thải theo các giai đoạn trong vòng đời sản phẩm.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            {emissions ? (
              <div className="space-y-5">
                {/* Hero Total Display */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 p-6 text-white shadow-sm border border-emerald-800/60 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    Tổng phát thải ước tính (Proxy)
                  </p>
                  <div className="my-2 flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-extrabold tracking-tight">
                      {emissions.total.toFixed(2)}
                    </span>
                    <span className="text-base font-semibold text-emerald-200">
                      kg CO₂e
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100/80 font-medium">
                    cho 1 đơn vị sản phẩm hoàn thiện
                  </p>
                </div>

                {/* Breakdown List */}
                <div className="space-y-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                    Phân rã theo từng nhóm phát thải
                  </h4>
                  {BREAKDOWN_META.map(({ key, icon: Icon, label, color, badgeBg }) => {
                    const value = emissions[key];
                    const sharePct = pct(value, emissions.total);

                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="flex items-center gap-2 text-slate-700 font-medium">
                            <Icon className={`w-4 h-4 ${color}`} />
                            {label}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 tabular-nums">
                              {value.toFixed(2)} kg CO₂e
                            </span>
                            <span className={`rounded-md border px-1.5 py-0.2 text-[11px] font-semibold ${badgeBg}`}>
                              {sharePct.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <Progress
                          value={sharePct}
                          className="h-2 rounded-full bg-slate-200/80"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Biogenic Stored Carbon */}
                {emissions.biogenic > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                    <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                      Carbon sinh học lưu trữ (Biogenic): -{emissions.biogenic.toFixed(2)} kg CO₂
                    </p>
                    <p className="text-[11px] text-emerald-800/80 mt-1 leading-relaxed">
                      Lượng carbon hấp thụ trong sợi tự nhiên/gỗ trong quá trình sinh trưởng, được báo cáo riêng theo tiêu chuẩn GHG Protocol / PAS 2050 (không cộng dồn vào tổng phát thải fossil).
                    </p>
                  </div>
                )}

                {/* Explanation Card */}
                <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">Ý nghĩa chỉ số</p>
                  <p className="leading-relaxed">
                    Mức {emissions.total.toFixed(2)} kg CO₂e là chỉ số ước tính proxy tổng hợp (Scope 1, 2 và 3). Để nâng cấp thành báo cáo kiểm toán có chữ ký số, hãy xuất dữ liệu này vào Hồ sơ lô hàng.
                  </p>
                </div>

                {/* AI Assessment Guidance Box */}
                <div className="space-y-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-white p-4 shadow-xs">
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        Đánh giá kết quả từ AI
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Phân tích trọng số phát thải và đưa ra 3 khuyến nghị tối ưu hóa vận hành.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={requestAssessment}
                      disabled={isAssessing}
                      className="h-8.5 shrink-0 rounded-lg border-indigo-200 bg-white text-xs font-semibold text-indigo-700 hover:bg-indigo-50 shadow-xs"
                    >
                      {isAssessing ? (
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600" />
                      )}
                      {assessment ? 'Đánh giá lại' : 'Đánh giá AI'}
                    </Button>
                  </div>

                  {isAssessing && (
                    <div className="flex items-center gap-2 rounded-xl bg-white/80 p-3 text-xs font-medium text-indigo-800 border border-indigo-100">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      Đang phân tích dữ liệu và khởi tạo khuyến nghị...
                    </div>
                  )}

                  {assessmentError && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{assessmentError}</span>
                    </div>
                  )}

                  {assessment && !isAssessing && (
                    <div className="rounded-xl border border-indigo-100 bg-white p-3.5 text-xs sm:text-sm leading-relaxed text-slate-800 shadow-2xs">
                      <ReactMarkdown
                        components={{
                          h3: ({ children }) => <p className="font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</p>,
                          h2: ({ children }) => <p className="font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</p>,
                          h1: ({ children }) => <p className="font-bold text-slate-900 mt-3 mb-1 first:mt-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-1">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-1">{children}</ol>,
                          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                          p: ({ children }) => <p className="my-1">{children}</p>,
                        }}
                      >
                        {assessment}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="min-h-[380px] flex flex-col items-center justify-center p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 border border-emerald-100">
                  <Leaf className="h-7 w-7" />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">Chưa có kết quả tính toán</h3>
                <p className="mt-1 max-w-xs text-xs text-slate-500 leading-relaxed">
                  Nhập thông tin sản phẩm và bấm <strong>Tính toán phát thải</strong> để xem biểu đồ phân rã và đề xuất giảm thiểu.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Methodology Reference Card ── */}
      <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-xs">
        <CardContent className="p-5">
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Nguồn hệ số phát thải
              </p>
              <p className="text-slate-500 leading-relaxed">
                Textile Exchange / Higg MSI 3.0 (dệt may) · DEFRA 2025 (vận tải biển) · IPCC 2006 GWP100.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Factory className="h-4 w-4 text-sky-600" />
                Phạm vi tính toán
              </p>
              <p className="text-slate-500 leading-relaxed">
                Bao gồm Scope 1, Scope 2 (lưới điện VN 2023), Scope 3 upstream nguyên liệu và chặng vận chuyển xuất khẩu.
              </p>
            </div>
            <div className="space-y-1">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-amber-600" />
                Khuyến nghị kiểm toán
              </p>
              <p className="text-slate-500 leading-relaxed">
                Hệ số trung bình ngành phù hợp định hình thiết kế ban đầu. Để phục vụ kê khai CBAM, hãy tải chứng từ sơ cấp lên hệ thống.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
