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
  Leaf,
  Factory,
  Truck,
  Package,
  Info,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Emission factors — kg CO₂e per kg of material (Ecoinvent v3.10 proxy)
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

// Transport emission factors: kg CO₂e / (kg·km)
const ROUTE_EMISSIONS: Record<string, { distance: number; factor: number }> = {
  vnEu: { distance: 15000, factor: 0.00016 },
  vnUs: { distance: 12500, factor: 0.00016 },
  vnJp: { distance: 3800, factor: 0.00016 },
  vnDomestic: { distance: 500, factor: 0.00025 },
  vnKr: { distance: 3200, factor: 0.00016 },
};

const MANUFACTURING_FACTOR = 2.5; // kg CO₂e per kg
const PACKAGING_FACTOR = 0.3; // kg CO₂e per kg

interface EmissionBreakdown {
  material: number;
  manufacturing: number;
  transport: number;
  packaging: number;
  total: number;
}

const MATERIAL_LABELS: Record<string, { vi: string; en: string }> = {
  cotton: { vi: 'Cotton thông thường', en: 'Conventional Cotton' },
  polyester: { vi: 'Polyester nguyên sinh', en: 'Virgin Polyester' },
  wool: { vi: 'Len (Wool)', en: 'Wool' },
  silk: { vi: 'Lụa tơ tằm', en: 'Silk' },
  linen: { vi: 'Linen (Lanh)', en: 'Linen' },
  recycledPoly: { vi: 'Polyester tái chế', en: 'Recycled Polyester' },
  organicCotton: { vi: 'Cotton hữu cơ', en: 'Organic Cotton' },
  hemp: { vi: 'Hemp (Gai dầu)', en: 'Hemp' },
};

const ROUTE_LABELS: Record<string, { vi: string; en: string }> = {
  vnEu: { vi: 'VN → EU (biển, ~15.000 km)', en: 'VN → EU (sea, ~15,000 km)' },
  vnUs: { vi: 'VN → Mỹ (biển, ~12.500 km)', en: 'VN → US (sea, ~12,500 km)' },
  vnJp: { vi: 'VN → Nhật (biển, ~3.800 km)', en: 'VN → Japan (sea, ~3,800 km)' },
  vnKr: { vi: 'VN → Hàn (biển, ~3.200 km)', en: 'VN → Korea (sea, ~3,200 km)' },
  vnDomestic: { vi: 'Nội địa (~500 km, xe tải)', en: 'Domestic (~500 km, truck)' },
};

const pct = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

export default function CarbonCalculator() {
  const { locale } = useLanguage();
  const vi = locale === 'vi';

  const [weight, setWeight] = useState('');
  const [material, setMaterial] = useState('');
  const [route, setRoute] = useState('');
  const [emissions, setEmissions] = useState<EmissionBreakdown | null>(null);

  const calculate = () => {
    if (!weight || !material || !route) return;
    const kg = parseFloat(weight);
    if (isNaN(kg) || kg <= 0) return;

    const matEmission = kg * (MATERIAL_FACTORS[material] ?? 0);
    const mfgEmission = kg * MANUFACTURING_FACTOR;
    const routeData = ROUTE_EMISSIONS[route];
    const trnEmission = kg * routeData.distance * routeData.factor;
    const pkgEmission = kg * PACKAGING_FACTOR;
    const total = matEmission + mfgEmission + trnEmission + pkgEmission;

    setEmissions({
      material: matEmission,
      manufacturing: mfgEmission,
      transport: trnEmission,
      packaging: pkgEmission,
      total,
    });
  };

  const canCalculate = weight && material && route;

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {vi ? 'Tính Carbon Proxy' : 'Carbon Proxy Calculator'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {vi
              ? 'Ước tính phát thải CO₂e của sản phẩm dệt may theo vật liệu, sản xuất và vận chuyển'
              : 'Estimate CO₂e emissions for textile products based on material, manufacturing and transport'}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Calculator Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-4 h-4 text-primary" />
              {vi ? 'Nhập thông tin sản phẩm' : 'Product information'}
            </CardTitle>
            <CardDescription className="text-xs">
              {vi
                ? 'Kết quả là ước tính proxy từ hệ số Ecoinvent v3.10 — chưa phải dữ liệu sơ cấp.'
                : 'Result is a proxy estimate from Ecoinvent v3.10 — not primary measured data.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Weight */}
            <div className="space-y-1.5">
              <Label htmlFor="weight">
                {vi ? 'Khối lượng sản phẩm (kg)' : 'Product weight (kg)'}
              </Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.25"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>

            {/* Material */}
            <div className="space-y-1.5">
              <Label>
                {vi ? 'Loại vật liệu chính' : 'Primary material type'}
              </Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={vi ? 'Chọn vật liệu' : 'Select material'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATERIAL_LABELS).map(([key, lbl]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {vi ? lbl.vi : lbl.en}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({MATERIAL_FACTORS[key]} kg CO₂e/kg)
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Shipping Route */}
            <div className="space-y-1.5">
              <Label>
                {vi ? 'Tuyến vận chuyển xuất khẩu' : 'Shipping route'}
              </Label>
              <Select value={route} onValueChange={setRoute}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={vi ? 'Chọn tuyến' : 'Select route'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROUTE_LABELS).map(([key, lbl]) => (
                    <SelectItem key={key} value={key}>
                      {vi ? lbl.vi : lbl.en}
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
              {vi ? 'Tính toán phát thải' : 'Calculate emissions'}
            </Button>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-500" />
              <span>
                {vi
                  ? 'Hệ số phát thải từ Ecoinvent v3.10 (ngành dệt may). Kết quả proxy — thay thế bằng dữ liệu đo đếm thực tế cho báo cáo kiểm toán.'
                  : 'Emission factors from Ecoinvent v3.10 (textiles). Proxy result — replace with measured data for audit-grade reporting.'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card
          className={`transition-opacity duration-300 ${emissions ? 'opacity-100' : 'opacity-50'}`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Leaf className="w-4 h-4 text-primary" />
              {vi ? 'Kết quả tính toán' : 'Calculation results'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emissions ? (
              <div className="space-y-6">
                {/* Total */}
                <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white">
                  <p className="text-sm font-medium opacity-80 mb-1">
                    {vi ? 'Tổng phát thải' : 'Total emissions'}
                  </p>
                  <p className="text-5xl font-bold mb-1">
                    {emissions.total.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-80">kg CO₂e</p>
                </div>

                {/* Breakdown */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">
                    {vi ? 'Phân rã theo nhóm' : 'Breakdown by category'}
                  </h4>

                  {[
                    {
                      icon: Leaf,
                      label: vi ? 'Vật liệu' : 'Material',
                      value: emissions.material,
                      color: 'text-green-600',
                    },
                    {
                      icon: Factory,
                      label: vi ? 'Sản xuất' : 'Manufacturing',
                      value: emissions.manufacturing,
                      color: 'text-blue-600',
                    },
                    {
                      icon: Truck,
                      label: vi ? 'Vận chuyển' : 'Transport',
                      value: emissions.transport,
                      color: 'text-orange-600',
                    },
                    {
                      icon: Package,
                      label: vi ? 'Đóng gói' : 'Packaging',
                      value: emissions.packaging,
                      color: 'text-purple-600',
                    },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-muted-foreground">
                          <Icon className={`w-4 h-4 ${color}`} />
                          {label}
                        </span>
                        <span className="font-medium">
                          {value.toFixed(2)} kg CO₂e
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
                  ))}
                </div>

                {/* Interpretation */}
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">
                    {vi ? 'Giải thích kết quả' : 'Result interpretation'}
                  </p>
                  <p>
                    {vi
                      ? `${emissions.total.toFixed(2)} kg CO₂e / sản phẩm là ước tính proxy Scope 1+2+3. `
                      : `${emissions.total.toFixed(2)} kg CO₂e / product is a Scope 1+2+3 proxy estimate. `}
                    {vi
                      ? 'Để đạt chuẩn kiểm toán, tải chứng từ lên Evidence và hệ thống sẽ tự động nâng cấp điểm tin cậy.'
                      : 'To reach audit-grade, upload evidence docs and the system will automatically upgrade the trust score.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calculator className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm">
                    {vi
                      ? 'Điền thông tin và nhấn "Tính toán" để xem kết quả'
                      : 'Fill in the form and click "Calculate" to see your emissions'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Panel */}
      <Card className="bg-sky-50 border-sky-200">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="font-semibold text-sky-900 mb-1">
                {vi ? 'Nguồn hệ số phát thải' : 'Emission factor sources'}
              </p>
              <p className="text-sky-800">
                Ecoinvent v3.10 (textiles) · IPCC 2021 GWP100 · Higg MSI 3.0
              </p>
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-1">
                {vi ? 'Phạm vi tính' : 'Calculation scope'}
              </p>
              <p className="text-sky-800">
                {vi
                  ? 'Scope 1 (đốt nhiên liệu trực tiếp) + Scope 2 (điện) + Scope 3 upstream (vật liệu, vận chuyển mua vào) + transport xuất khẩu'
                  : 'Scope 1 (direct fuel) + Scope 2 (electricity) + Scope 3 upstream (materials, inbound transport) + export transport'}
              </p>
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-1">
                {vi ? 'Hạn chế' : 'Limitations'}
              </p>
              <p className="text-sky-800">
                {vi
                  ? 'Hệ số trung bình ngành — sai số ±20-40% so với dữ liệu sơ cấp. Không dùng trực tiếp cho báo cáo CBAM/GHG Protocol.'
                  : 'Industry-average factors — ±20-40% vs primary data. Not suitable for direct CBAM/GHG Protocol submission.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
