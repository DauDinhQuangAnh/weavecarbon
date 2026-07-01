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
  cotton: 'Cotton thﾃｴng thﾆｰ盻拵g',
  polyester: 'Polyester nguyﾃｪn sinh',
  wool: 'Len',
  silk: 'L盻･a tﾆ｡ t蘯ｱm',
  linen: 'Linen',
  recycledPoly: 'Polyester tﾃ｡i ch蘯ｿ',
  organicCotton: 'Cotton h盻ｯu cﾆ｡',
  hemp: 'Hemp',
};

const ROUTE_LABELS: Record<string, string> = {
  vnEu: 'Vi盻㏄ Nam - EU (ﾄ柁ｰ盻拵g bi盻ハ, kho蘯｣ng 15.000 km)',
  vnUs: 'Vi盻㏄ Nam - M盻ｹ (ﾄ柁ｰ盻拵g bi盻ハ, kho蘯｣ng 12.500 km)',
  vnJp: 'Vi盻㏄ Nam - Nh蘯ｭt B蘯｣n (ﾄ柁ｰ盻拵g bi盻ハ, kho蘯｣ng 3.800 km)',
  vnKr: 'Vi盻㏄ Nam - Hﾃn Qu盻祖 (ﾄ柁ｰ盻拵g bi盻ハ, kho蘯｣ng 3.200 km)',
  vnDomestic: 'N盻冓 ﾄ黛ｻ蟻 (kho蘯｣ng 500 km, xe t蘯｣i)',
};

const BREAKDOWN_META = [
  { key: 'material', icon: Leaf, label: 'V蘯ｭt li盻㎡', color: 'text-green-600' },
  { key: 'manufacturing', icon: Factory, label: 'S蘯｣n xu蘯･t', color: 'text-blue-600' },
  { key: 'transport', icon: Truck, label: 'V蘯ｭn chuy盻ハ', color: 'text-orange-600' },
  { key: 'packaging', icon: Package, label: 'ﾄ静ｳng gﾃｳi', color: 'text-purple-600' },
] as const;

const pct = (value: number, total: number) =>
  total > 0 ? (value / total) * 100 : 0;

const SUGGESTED_QUESTIONS = [
  "Lﾃm th蘯ｿ nﾃo ﾄ黛ｻ・gi蘯｣m phﾃ｡t th蘯｣i t盻ｫ v蘯ｭt li盻㎡ nﾃy?",
  "So sﾃ｡nh v盻嬖 trung bﾃｬnh ngﾃnh d盻㏄ may",
  "G盻｣i ﾃｽ v蘯ｭt li盻㎡ thay th蘯ｿ ﾃｭt carbon hﾆ｡n",
  "Gi蘯｣i thﾃｭch phﾃ｡t th蘯｣i v蘯ｭn chuy盻ハ ﾄ柁ｰ盻拵g bi盻ハ",
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

  return `Ng盻ｯ c蘯｣nh tﾃｭnh toﾃ｡n carbon v盻ｫa th盻ｱc hi盻㌻:
- S蘯｣n ph蘯ｩm d盻㏄ may, kh盻訴 lﾆｰ盻｣ng: ${context.weight} kg
- V蘯ｭt li盻㎡ chﾃｭnh: ${materialLabel} (${MATERIAL_FACTORS[context.material]} kg CO2e/kg)
- Tuy蘯ｿn v蘯ｭn chuy盻ハ: ${routeLabel}
- T盻貧g phﾃ｡t th蘯｣i: ${context.emissions.total.toFixed(2)} kg CO2e/s蘯｣n ph蘯ｩm
  窶｢ V蘯ｭt li盻㎡: ${context.emissions.material.toFixed(2)} kg CO2e (${((context.emissions.material / context.emissions.total) * 100).toFixed(0)}%)
  窶｢ S蘯｣n xu蘯･t: ${context.emissions.manufacturing.toFixed(2)} kg CO2e (${((context.emissions.manufacturing / context.emissions.total) * 100).toFixed(0)}%)
  窶｢ V蘯ｭn chuy盻ハ: ${context.emissions.transport.toFixed(2)} kg CO2e (${((context.emissions.transport / context.emissions.total) * 100).toFixed(0)}%)
  窶｢ ﾄ静ｳng gﾃｳi: ${context.emissions.packaging.toFixed(2)} kg CO2e (${((context.emissions.packaging / context.emissions.total) * 100).toFixed(0)}%)

Cﾃ｢u h盻淑: ${query}`;
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
      const msg = err instanceof Error ? err.message : 'L盻擁 khﾃｴng xﾃ｡c ﾄ黛ｻ杵h';
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
          <h1 className="text-2xl font-bold">Tﾃｭnh Carbon Proxy</h1>
          <p className="text-sm text-muted-foreground">
            ﾆｯ盻嫩 tﾃｭnh phﾃ｡t th蘯｣i CO2e c盻ｧa s蘯｣n ph蘯ｩm d盻㏄ may theo v蘯ｭt li盻㎡, s蘯｣n xu蘯･t vﾃ v蘯ｭn chuy盻ハ.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="w-4 h-4 text-primary" />
              Nh蘯ｭp thﾃｴng tin s蘯｣n ph蘯ｩm
            </CardTitle>
            <CardDescription className="text-xs">
              K蘯ｿt qu蘯｣ lﾃ ﾆｰ盻嫩 tﾃｭnh proxy t盻ｫ h盻・s盻・Ecoinvent v3.10, chﾆｰa thay th蘯ｿ d盻ｯ li盻㎡ sﾆ｡ c蘯･p.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="weight">Kh盻訴 lﾆｰ盻｣ng s蘯｣n ph蘯ｩm (kg)</Label>
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
              <Label>Lo蘯｡i v蘯ｭt li盻㎡ chﾃｭnh</Label>
              <Select value={material} onValueChange={setMaterial}>
                <SelectTrigger>
                  <SelectValue placeholder="Ch盻肱 v蘯ｭt li盻㎡" />
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
              <Label>Tuy蘯ｿn v蘯ｭn chuy盻ハ xu蘯･t kh蘯ｩu</Label>
              <Select value={route} onValueChange={setRoute}>
                <SelectTrigger>
                  <SelectValue placeholder="Ch盻肱 tuy蘯ｿn" />
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
              Tﾃｭnh toﾃ｡n phﾃ｡t th蘯｣i
            </Button>

            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-500" />
              <span>
                H盻・s盻・phﾃ｡t th蘯｣i l蘯･y t盻ｫ proxy ngﾃnh d盻㏄ may. V盻嬖 bﾃ｡o cﾃ｡o ki盻ノ toﾃ｡n, hﾃ｣y thay b蘯ｱng d盻ｯ li盻㎡ ﾄ双 ﾄ黛ｺ｡c vﾃ ch盻ｩng t盻ｫ th盻ｱc t蘯ｿ.
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
              K蘯ｿt qu蘯｣ tﾃｭnh toﾃ｡n
            </CardTitle>
          </CardHeader>
          <CardContent>
            {emissions ? (
              <div className="space-y-6">
                <div className="text-center p-6 rounded-2xl bg-gradient-to-br from-emerald-600 to-green-700 text-white">
                  <p className="text-sm font-medium opacity-80 mb-1">
                    T盻貧g phﾃ｡t th蘯｣i
                  </p>
                  <p className="text-5xl font-bold mb-1">
                    {emissions.total.toFixed(2)}
                  </p>
                  <p className="text-sm opacity-80">kg CO2e</p>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Phﾃ｢n rﾃ｣ theo nhﾃｳm</h4>
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
                  <p className="font-medium text-foreground">Gi蘯｣i thﾃｭch k蘯ｿt qu蘯｣</p>
                  <p>
                    {emissions.total.toFixed(2)} kg CO2e / s蘯｣n ph蘯ｩm lﾃ ﾆｰ盻嫩 tﾃｭnh proxy Scope 1+2+3. ﾄ雪ｻ・ﾄ黛ｺ｡t chu蘯ｩn ki盻ノ toﾃ｡n, hﾃ｣y t蘯｣i ch盻ｩng t盻ｫ lﾃｪn Evidence ﾄ黛ｻ・h盻・th盻創g nﾃ｢ng c蘯･p ﾄ黛ｻ・tin c蘯ｭy.
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calculator className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm">
                    ﾄ進盻］ thﾃｴng tin vﾃ nh蘯･n nﾃｺt Tﾃｭnh toﾃ｡n ﾄ黛ｻ・xem k蘯ｿt qu蘯｣.
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
                Ngu盻渡 h盻・s盻・phﾃ｡t th蘯｣i
              </p>
              <p className="text-sky-800">
                Ecoinvent v3.10 (textiles) - IPCC 2021 GWP100 - Higg MSI 3.0
              </p>
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-1">Ph蘯｡m vi tﾃｭnh</p>
              <p className="text-sky-800">
                Scope 1, Scope 2, Scope 3 upstream vﾃ v蘯ｭn chuy盻ハ xu蘯･t kh蘯ｩu.
              </p>
            </div>
            <div>
              <p className="font-semibold text-sky-900 mb-1">H蘯｡n ch蘯ｿ</p>
              <p className="text-sky-800">
                H盻・s盻・trung bﾃｬnh ngﾃnh cﾃｳ th盻・l盻㌘h 20-40% so v盻嬖 d盻ｯ li盻㎡ sﾆ｡ c蘯･p, khﾃｴng dﾃｹng tr盻ｱc ti蘯ｿp cho CBAM ho蘯ｷc GHG Protocol.
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
            Tr盻｣ lﾃｽ Carbon AI
            <span className="ml-auto text-xs font-normal text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-400" />
              Powered by Gemini
            </span>
          </CardTitle>
          <CardDescription className="text-xs">
            ﾄ雪ｺｷt cﾃ｢u h盻淑 v盻・k蘯ｿt qu蘯｣ tﾃｭnh toﾃ｡n, phﾆｰﾆ｡ng ﾃ｡n gi蘯｣m thi盻ブ carbon ho蘯ｷc ki蘯ｿn th盻ｩc ngﾃnh d盻㏄ may.
            {emissions && (
              <span className="text-violet-600 font-medium ml-1">
                AI ﾄ妥｣ cﾃｳ ng盻ｯ c蘯｣nh t盻ｫ k蘯ｿt qu蘯｣ tﾃｭnh toﾃ｡n c盻ｧa b蘯｡n.
              </span>
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Suggested questions 窶・only show when chat is empty */}
          {aiMessages.length === 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">G盻｣i ﾃｽ cﾃ｢u h盻淑:</p>
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
                Khﾃｴng th盻・k蘯ｿt n盻訴 RAG API: <span className="font-medium">{aiError}</span>. Ki盻ノ tra server ﾄ疎ng ch蘯｡y t蘯｡i <code className="bg-red-100 px-1 rounded">http://127.0.0.1:8000</code>
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
                  ? "H盻淑 v盻・k蘯ｿt qu蘯｣ tﾃｭnh toﾃ｡n ho蘯ｷc cﾃ｡ch gi蘯｣m phﾃ｡t th蘯｣i..."
                  : "H盻淑 v盻・carbon footprint trong ngﾃnh d盻㏄ may..."
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
              Xﾃｳa l盻議h s盻ｭ chat
            </button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
