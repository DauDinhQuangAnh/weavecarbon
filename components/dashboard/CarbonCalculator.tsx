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

const MATERIAL_FACTORS: Record<string, number> = {
  cotton: 5.9,
  polyester: 6.4,
  wool: 10.1,
  silk: 8.5,
  linen: 1.5,
  recycledPoly: 2.1,
  organicCotton: 3.8,
  hemp: 2.3,
};

const MANUFACTURING_FACTOR = 2.5;
const PACKAGING_FACTOR = 0.3;
const TRANSPORT_FACTOR = 0.00016;

interface EmissionBreakdown {
  material: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
}

const MATERIAL_LABELS: Record<string, string> = {
  cotton: 'Cotton thông thường',
  polyester: 'Polyester nguyên sinh',
  wool: 'Len',
  silk: 'Lụa tơ tằm',
  linen: 'Linen',
  recycledPoly: 'Polyester tái chế',
  organicCotton: 'Cotton hữu cơ',
  hemp: 'Hemp',
};

const BREAKDOWN_META = [
  { key: 'material', icon: Leaf, label: 'Vật liệu', color: 'text-green-600' },
  { key: 'manufacturing', icon: Factory, label: 'Sản xuất', color: 'text-blue-600' },
  { key: 'transport', icon: Truck, label: 'Vận chuyển', color: 'text-orange-600' },
  { key: 'packaging', icon: Package, label: 'Đóng gói', color: 'text-purple-600' },
] as const;

const pct = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

function buildAssessmentPrompt(context: {
  weight: string;
  material: string;
  destination: string;
  transportDistance: string;
  emissions: EmissionBreakdown;
}): string {
  const materialLabel = MATERIAL_LABELS[context.material] ?? context.material;
  const materialFactor = MATERIAL_FACTORS[context.material] ?? 0;

  return `Bạn là chuyên gia tư vấn carbon footprint cho sản phẩm dệt may.

Hãy đánh giá ngắn gọn kết quả tính carbon proxy dưới đây bằng tiếng Việt, tập trung vào quyết định vận hành:
- Nêu nhận định chính về mức phát thải và nhóm đóng góp lớn nhất.
- Chỉ ra 2-3 nguyên nhân có khả năng làm phát thải cao.
- Đề xuất 3 hành động giảm phát thải theo thứ tự ưu tiên.
- Nêu rõ đây là ước tính proxy, không thay thế dữ liệu sơ cấp/audit.
- Trả lời có cấu trúc, thực tế, không hỏi lại người dùng.

Dữ liệu đầu vào:
- Khối lượng sản phẩm: ${context.weight} kg
- Vật liệu chính: ${materialLabel}
- Hệ số vật liệu: ${materialFactor} kg CO2e/kg
- Điểm đến vận chuyển: ${context.destination}
- Khoảng cách vận chuyển: ${context.transportDistance} km
- Hệ số vận chuyển proxy: ${TRANSPORT_FACTOR} kg CO2e/kg.km
- Hệ số sản xuất proxy: ${MANUFACTURING_FACTOR} kg CO2e/kg
- Hệ số đóng gói proxy: ${PACKAGING_FACTOR} kg CO2e/kg

Kết quả:
- Tổng phát thải: ${context.emissions.total.toFixed(2)} kg CO2e/sản phẩm
- Vật liệu: ${context.emissions.material.toFixed(2)} kg CO2e (${pct(context.emissions.material, context.emissions.total).toFixed(0)}%)
- Sản xuất: ${context.emissions.manufacturing.toFixed(2)} kg CO2e (${pct(context.emissions.manufacturing, context.emissions.total).toFixed(0)}%)
- Vận chuyển: ${context.emissions.transport.toFixed(2)} kg CO2e (${pct(context.emissions.transport, context.emissions.total).toFixed(0)}%)
- Đóng gói: ${context.emissions.packaging.toFixed(2)} kg CO2e (${pct(context.emissions.packaging, context.emissions.total).toFixed(0)}%)`;
}

export default function CarbonCalculator() {
  const [weight, setWeight] = useState('');
  const [material, setMaterial] = useState('');
  const [destination, setDestination] = useState('');
  const [transportDistance, setTransportDistance] = useState('');
  const [emissions, setEmissions] = useState<EmissionBreakdown | null>(null);
  const [assessment, setAssessment] = useState<string | null>(null);
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessmentError, setAssessmentError] = useState<string | null>(null);

  const resetDerivedState = () => {
    setEmissions(null);
    setAssessment(null);
    setAssessmentError(null);
  };

  const calculate = () => {
    if (!weight || !material || !destination || !transportDistance) return;

    const kg = parseFloat(weight);
    const distanceKm = parseFloat(transportDistance);
    if (Number.isNaN(kg) || kg <= 0 || Number.isNaN(distanceKm) || distanceKm <= 0) return;

    const materialEmission = kg * (MATERIAL_FACTORS[material] ?? 0);
    const manufacturingEmission = kg * MANUFACTURING_FACTOR;
    const transportEmission = kg * distanceKm * TRANSPORT_FACTOR;
    const packagingEmission = kg * PACKAGING_FACTOR;
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
            Ước tính phát thải CO2e của sản phẩm dệt may theo vật liệu, sản xuất và vận chuyển.
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
              Kết quả là ước tính proxy từ hệ số Ecoinvent v3.10, chưa thay thế dữ liệu sơ cấp.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
                  {Object.entries(MATERIAL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {label}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({MATERIAL_FACTORS[key]} kg CO2e/kg)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="destination">Điểm đến xuất khẩu</Label>
                <Input
                  id="destination"
                  placeholder="Ví dụ: Tokyo, Nhật Bản"
                  value={destination}
                  onChange={(event) => {
                    setDestination(event.target.value);
                    resetDerivedState();
                  }}
                />
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
                Hệ số phát thải lấy từ proxy ngành dệt may. Với báo cáo kiểm toán, hãy thay bằng dữ liệu đo đạc và chứng từ thực tế.
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
                    <div className="rounded-md bg-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                      {assessment}
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
                Ecoinvent v3.10 (textiles) - IPCC 2021 GWP100 - Higg MSI 3.0
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
