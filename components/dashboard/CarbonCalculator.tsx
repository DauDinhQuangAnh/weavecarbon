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
  Package,
  Truck,
} from 'lucide-react';

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

const ROUTE_EMISSIONS: Record<string, { distance: number; factor: number }> = {
  vnEu: { distance: 15000, factor: 0.00016 },
  vnUs: { distance: 12500, factor: 0.00016 },
  vnJp: { distance: 3800, factor: 0.00016 },
  vnDomestic: { distance: 500, factor: 0.00025 },
  vnKr: { distance: 3200, factor: 0.00016 },
};

const MANUFACTURING_FACTOR = 2.5;
const PACKAGING_FACTOR = 0.3;

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

const ROUTE_LABELS: Record<string, string> = {
  vnEu: 'Việt Nam - EU (đường biển, khoảng 15.000 km)',
  vnUs: 'Việt Nam - Mỹ (đường biển, khoảng 12.500 km)',
  vnJp: 'Việt Nam - Nhật Bản (đường biển, khoảng 3.800 km)',
  vnKr: 'Việt Nam - Hàn Quốc (đường biển, khoảng 3.200 km)',
  vnDomestic: 'Nội địa (khoảng 500 km, xe tải)',
};

const BREAKDOWN_META = [
  { key: 'material', icon: Leaf, label: 'Vật liệu', color: 'text-green-600' },
  { key: 'manufacturing', icon: Factory, label: 'Sản xuất', color: 'text-blue-600' },
  { key: 'transport', icon: Truck, label: 'Vận chuyển', color: 'text-orange-600' },
  { key: 'packaging', icon: Package, label: 'Đóng gói', color: 'text-purple-600' },
] as const;

const pct = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

export default function CarbonCalculator() {
  const [weight, setWeight] = useState('');
  const [material, setMaterial] = useState('');
  const [route, setRoute] = useState('');
  const [emissions, setEmissions] = useState<EmissionBreakdown | null>(null);

  const calculate = () => {
    if (!weight || !material || !route) return;

    const kg = parseFloat(weight);
    const routeData = ROUTE_EMISSIONS[route];
    if (Number.isNaN(kg) || kg <= 0 || !routeData) return;

    const materialEmission = kg * (MATERIAL_FACTORS[material] ?? 0);
    const manufacturingEmission = kg * MANUFACTURING_FACTOR;
    const transportEmission = kg * routeData.distance * routeData.factor;
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
  };

  const canCalculate = weight && material && route;

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
                onChange={(event) => setWeight(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Loại vật liệu chính</Label>
              <Select value={material} onValueChange={setMaterial}>
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

            <div className="space-y-1.5">
              <Label>Tuyến vận chuyển xuất khẩu</Label>
              <Select value={route} onValueChange={setRoute}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn tuyến" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROUTE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
