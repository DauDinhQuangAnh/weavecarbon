'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Bot,
  Calculator,
  ChevronRight,
  Factory,
  Info,
  Leaf,
  Loader2,
  Package,
  Send,
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

const SUGGESTED_QUESTIONS = [
  "Làm thế nào để giảm phát thải từ vật liệu này?",
  "So sánh với trung bình ngành dệt may",
  "Gợi ý vật liệu thay thế ít carbon hơn",
  "Giải thích phát thải vận chuyển đường biển",
];

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

function buildAiPrompt(query: string, context: {
  weight: string;
  material: string;
  route: string;
  emissions: EmissionBreakdown | null;
}): string {
  if (!context.emissions) return query;

  const materialLabel = MATERIAL_LABELS[context.material] ?? context.material;
  const routeLabel = ROUTE_LABELS[context.route] ?? context.route;

  return `Ngữ cảnh tính toán carbon vừa thực hiện:
- Sản phẩm dệt may, khối lượng: ${context.weight} kg
- Vật liệu chính: ${materialLabel} (${MATERIAL_FACTORS[context.material]} kg CO2e/kg)
- Tuyến vận chuyển: ${routeLabel}
- Tổng phát thải: ${context.emissions.total.toFixed(2)} kg CO2e/sản phẩm
  • Vật liệu: ${context.emissions.material.toFixed(2)} kg CO2e (${((context.emissions.material / context.emissions.total) * 100).toFixed(0)}%)
  • Sản xuất: ${context.emissions.manufacturing.toFixed(2)} kg CO2e (${((context.emissions.manufacturing / context.emissions.total) * 100).toFixed(0)}%)
  • Vận chuyển: ${context.emissions.transport.toFixed(2)} kg CO2e (${((context.emissions.transport / context.emissions.total) * 100).toFixed(0)}%)
  • Đóng gói: ${context.emissions.packaging.toFixed(2)} kg CO2e (${((context.emissions.packaging / context.emissions.total) * 100).toFixed(0)}%)

Câu hỏi: ${query}`;
}

export default function CarbonCalculator() {
  const [weight, setWeight] = useState('');
  const [material, setMaterial] = useState('');
  const [route, setRoute] = useState('');
  const [emissions, setEmissions] = useState<EmissionBreakdown | null>(null);

  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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

  const askAi = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || isAiLoading) return;

    const userMsg: AiMessage = { role: "user", content: trimmed };
    setAiMessages((prev) => [...prev, userMsg]);
    setAiInput('');
    setAiError(null);
    setIsAiLoading(true);

    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const prompt = buildAiPrompt(trimmed, { weight, material, route, emissions });
      const data = await api.post<{ answer?: string }>('/chat/direct', { query: prompt });
      if (!data.answer) {
        throw new Error('AI không trả về câu trả lời.');
      }

      setAiMessages((prev) => [...prev, { role: "assistant", content: data.answer! }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
      setAiError(msg);
      setAiMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsAiLoading(false);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
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

      {/* AI Assistant Panel */}
      <Card className="border-violet-100">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-violet-600" />
            </div>
            Trợ lý Carbon AI
            <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" />
              Powered by Gemini
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            Đặt câu hỏi về kết quả tính toán, phương án giảm thiểu carbon hoặc kiến thức ngành dệt may.
            {emissions && (
              <span className="text-violet-600 font-medium ml-1">
                AI đã có ngữ cảnh từ kết quả tính toán của bạn.
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Suggested questions — only show when chat is empty */}
          {aiMessages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Gợi ý câu hỏi:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => askAi(q)}
                    disabled={isAiLoading}
                    className="flex items-center gap-1 text-xs rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="w-3 h-3" />
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat history */}
          {aiMessages.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {aiMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-violet-600 text-white rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center shrink-0 mt-0.5 text-white text-xs font-bold">
                      B
                    </div>
                  )}
                </div>
              ))}

              {isAiLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-violet-600" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-3 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>
          )}

          {/* Error */}
          {aiError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Không thể kết nối RAG API: <span className="font-medium">{aiError}</span>. Kiểm tra server đang chạy tại <code className="bg-red-100 px-1 rounded">http://127.0.0.1:8000</code>
              </span>
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 pt-1">
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder={
                emissions
                  ? "Hỏi về kết quả tính toán hoặc cách giảm phát thải..."
                  : "Hỏi về carbon footprint trong ngành dệt may..."
              }
              className="min-h-[2.75rem] max-h-32 resize-none text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void askAi(aiInput);
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              className="shrink-0 h-11 w-11 bg-violet-600 hover:bg-violet-700"
              onClick={() => askAi(aiInput)}
              disabled={!aiInput.trim() || isAiLoading}
            >
              {isAiLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>

          {aiMessages.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { setAiMessages([]); setAiError(null); }}
            >
              Xóa lịch sử chat
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
