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
  Factory,
  Info,
  Leaf,
  Loader2,
  Package,
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
  wood_pallet: [
    { value: 'cat-wood-softwood-new', label: 'Gỗ thông xẻ, sấy khô (mới)' },
    { value: 'cat-wood-recycled', label: 'Gỗ pallet tái chế/thu hồi' },
  ],
};

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  textile: 'Dệt may',
  wood_pallet: 'Pallet gỗ',
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
  { value: 'eu', label: 'Liên minh Châu Âu', distanceKm: 15000 },
  { value: 'us', label: 'Hoa Kỳ', distanceKm: 12500 },
  { value: 'uk', label: 'Vương quốc Anh', distanceKm: 14500 },
  { value: 'australia', label: 'Úc', distanceKm: 6800 },
  { value: 'domestic', label: 'Nội địa Việt Nam', distanceKm: 500 },
] as const;

const BREAKDOWN_META = [
  { key: 'material', icon: Leaf, label: 'Vật liệu', color: 'text-green-600' },
  { key: 'manufacturing', icon: Factory, label: 'Sản xuất', color: 'text-blue-600' },
  { key: 'transport', icon: Truck, label: 'Vận chuyển', color: 'text-orange-600' },
  { key: 'packaging', icon: Package, label: 'Đóng gói', color: 'text-purple-600' },
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
    <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Tính Carbon Proxy</h1>
          <p className="text-sm text-muted-foreground">
            Ước tính phát thải CO2e theo ngành hàng, vật liệu, sản xuất và vận chuyển.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-4 h-4 text-primary" />
              Nhập thông tin sản phẩm
            </CardTitle>
            <CardDescription className="text-xs">
              Kết quả là ước tính proxy, chưa thay thế dữ liệu sơ cấp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label>Ngành hàng</Label>
              <Select
                value={category}
                onValueChange={(value) => handleCategoryChange(value as ProductCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="weight">Khối lượng sản phẩm (kg)</Label>
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
              />
            </div>

            <div className="space-y-1.5">
              <Label>Loại vật liệu chính</Label>
              <Select
                value={material}
                onValueChange={(value) => {
                  setMaterial(value);
                  resetDerivedState();
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Chọn vật liệu" />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        {option.label}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({getCarbonFactor(option.value)?.value ?? 0} kg CO2e/kg)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Điểm đến xuất khẩu</Label>
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
                  <SelectTrigger id="destination">
                    <SelectValue placeholder="Chọn điểm đến" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          {option.label}
                          <span className="text-xs text-muted-foreground ml-1">
                            (~{option.distanceKm.toLocaleString('vi-VN')} km)
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="transportDistance">Số km vận chuyển</Label>
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
                />
                <p className="text-xs text-muted-foreground">
                  Dùng hệ số proxy vận chuyển đường biển {TRANSPORT_FACTOR} kg CO2e/kg.km.
                </p>
              </div>
            </div>

            <Button
              className="w-full"
              onClick={calculate}
              disabled={!canCalculate}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Tính toán phát thải
            </Button>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-500" />
              <span>
                Hệ số phát thải lấy từ proxy theo ngành hàng đã chọn. Với báo cáo kiểm toán, hãy thay bằng dữ liệu đo đạc và chứng từ thực tế.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`transition-opacity duration-300 ${emissions ? 'opacity-100' : 'opacity-50'}`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="w-4 h-4 text-primary" />
              Kết quả tính toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emissions ? (
              <div className="space-y-6">
                <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white">
                  <p className="text-sm font-medium opacity-80 mb-1">
                    Tổng phát thải
                  </p>
                  <p className="text-5xl font-bold mb-1">
                    {emissions.total.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-80">kg CO2e</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Phân rã theo nhóm</h4>
                  {BREAKDOWN_META.map(({ key, icon: Icon, label, color }) => {
                    const value = emissions[key];

                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-muted-foreground">
                            <Icon className={`w-4 h-4 ${color}`} />
                            {label}
                          </span>
                          <span className="font-medium">
                            {value.toFixed(2)} kg CO2e
                            <span className="text-xs text-muted-foreground ml-1">
                              ({pct(value, emissions.total).toFixed(0)}%)
                            </span>
                          </span>
                        </div>
                        <Progress
                          value={pct(value, emissions.total)}
                          className="h-1.5"
                        />
                      </div>
                    );
                  })}
                </div>

                {emissions.biogenic > 0 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                    <p className="text-sm font-medium text-emerald-700">
                      Carbon sinh học (biogenic): -{emissions.biogenic.toFixed(2)} kg CO2
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      CO₂ lưu trữ trong vật liệu gỗ, báo cáo riêng theo GHG Protocol/PAS 2050 — không cộng vào tổng phát thải ở trên.
                    </p>
                  </div>
                )}

                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Giải thích kết quả</p>
                  <p>
                    {emissions.total.toFixed(2)} kg CO2e / sản phẩm là ước tính proxy Scope 1+2+3. Để đạt chuẩn kiểm toán, hãy tải chứng từ lên Evidence để hệ thống nâng cấp độ tin cậy.
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border border-violet-100 bg-violet-50/50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Đánh giá kết quả
                      </p>
                      <p className="text-xs text-muted-foreground">
                        AI sẽ phân tích các tham số vừa tính và gợi ý hướng giảm phát thải.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={requestAssessment}
                      disabled={isAssessing}
                      className="shrink-0 border-violet-200 bg-white text-violet-700 hover:bg-violet-100"
                    >
                      {isAssessing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {assessment ? 'Đánh giá lại' : 'Đánh giá'}
                    </Button>
                  </div>

                  {isAssessing && (
                    <div className="flex items-center gap-2 rounded-md bg-white/70 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                      Đang tạo đánh giá...
                    </div>
                  )}

                  {assessmentError && (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{assessmentError}</span>
                    </div>
                  )}

                  {assessment && !isAssessing && (
                    <div className="rounded-md bg-white px-3 py-2 text-sm leading-relaxed text-foreground">
                      <ReactMarkdown
                        components={{
                          h3: ({ children }) => <p className="font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</p>,
                          h2: ({ children }) => <p className="font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</p>,
                          h1: ({ children }) => <p className="font-semibold text-foreground mt-3 mb-1 first:mt-0">{children}</p>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          ul: ({ children }) => <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
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
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calculator className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm">
                    Điền thông tin và nhấn nút Tính toán để xem kết quả.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-sky-50 border-sky-200">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-semibold text-sky-900 mb-1">
                Nguồn hệ số phát thải
              </p>
              <p className="text-sky-800">
                Textile Exchange / Higg MSI 3.0 (dệt may) · WeaveCarbon internal proxy (pallet gỗ) · IPCC 2006 GWP100
              </p>
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-1">Phạm vi tính</p>
              <p className="text-sky-800">
                Scope 1, Scope 2, Scope 3 upstream và vận chuyển xuất khẩu.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-1">Hạn chế</p>
              <p className="text-sky-800">
                Hệ số trung bình ngành có thể lệch 20-40% so với dữ liệu sơ cấp, không dùng trực tiếp cho CBAM hoặc GHG Protocol.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
