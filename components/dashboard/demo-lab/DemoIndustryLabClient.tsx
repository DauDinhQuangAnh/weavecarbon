"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, Factory, FileCheck2, Gauge, Layers3, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isDemoPath } from "@/lib/demo/routes";
import {
  FALLBACK_INPUTS as inputs,
  FALLBACK_SOURCES as sources,
  FALLBACK_USE_CASES as useCases,
  translateDemoText,
} from "@/lib/industrialPortfolio/sourceBackedDemo";

/* Phòng demo theo ngành — đồng bộ từ bản Lovable (dữ liệu nguồn công khai, chỉ đọc). */
const formatValue = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(value));

const INDUSTRY_VI: Record<string, string> = {
  Aluminium: 'Nhôm',
  Cement: 'Xi măng',
  'Construction Materials': 'Vật liệu xây dựng',
  'Fertilisers & Chemicals': 'Phân bón & hóa chất',
  'Mining & Minerals': 'Khai khoáng & khoáng sản',
  Steel: 'Thép',
  Agriculture: 'Nông nghiệp',
};

const USE_CASE_VI: Record<string, { problem: string; domestic: string; export: string }> = {
  Agriculture: {
    problem: 'Buyer EU yêu cầu carbon cấp sản phẩm cùng bằng chứng EUDR (toạ độ vùng trồng, không phá rừng) trong khi dữ liệu nông hộ/hợp tác xã còn phân tán.',
    domestic: 'Kiểm kê GHG cho nhà máy sơ chế/chế biến, điểm nóng nhiên liệu sấy, phân bón và mức độ đầy đủ của bằng chứng.',
    export: 'Hồ sơ PCF cho buyer, gói ISO 14067 và mức độ sẵn sàng thẩm định EUDR.',
  },
  Steel: {
    problem: 'Phát thải Scope 1 và phát thải quá trình cao, đồng thời chịu áp lực MRV/hạn ngạch và EU CBAM với hàng hóa thuộc phạm vi.',
    domestic: 'Kiểm kê GHG/MRV tại Việt Nam, cường độ phát thải theo quá trình và bằng chứng thu hồi năng lượng.',
    export: 'Hồ sơ EU CBAM theo cơ sở/hàng hóa và bộ bằng chứng phục vụ xác minh.',
  },
  Cement: {
    problem: 'Phát thải từ calcination và nhiên liệu lò nung cần dữ liệu theo quá trình, không thể chỉ dựa trên hóa đơn năng lượng.',
    domestic: 'Kiểm kê GHG/MRV tại Việt Nam và theo dõi cường độ clinker/lò nung.',
    export: 'EU CBAM cho hàng xi măng thuộc phạm vi cùng bộ hồ sơ ISO/GHG có bằng chứng.',
  },
  Aluminium: {
    problem: 'Điện năng, tuyến công nghệ sản xuất và CN code của sản phẩm ảnh hưởng đáng kể đến cách xử lý carbon khi xuất khẩu.',
    domestic: 'Kiểm kê cấp cơ sở và phân bổ năng lượng theo quá trình.',
    export: 'EU CBAM cho các CN code nhôm thuộc phạm vi và buyer PCF.',
  },
  'Fertilisers & Chemicals': {
    problem: 'Khí tự nhiên có thể vừa là nhiên liệu vừa là feedstock, nên việc phân loại nguồn và boundary quá trình là rất quan trọng.',
    domestic: 'Kiểm kê GHG/MRV tại Việt Nam và tách riêng nguồn Scope 1/2/3.',
    export: 'EU CBAM cho phân bón thuộc phạm vi cùng bộ bằng chứng theo buyer/ISO.',
  },
  'Mining & Minerals': {
    problem: 'Hoạt động khai thác và tuyển khoáng tiêu thụ nhiều diesel/điện, tạo ra dữ liệu nguồn phân tán và khoảng trống bằng chứng.',
    domestic: 'Kiểm kê cấp cơ sở, cường độ năng lượng/tài nguyên và theo dõi kế hoạch giảm phát thải.',
    export: 'Bằng chứng nhà cung cấp và dữ liệu upstream phục vụ buyer PCF.',
  },
  'Construction Materials': {
    problem: 'Carbon sản phẩm và các công đoạn tiêu thụ điện cao cần dữ liệu doanh nghiệp có bằng chứng và cơ chế phân bổ xuống sản phẩm.',
    domestic: 'Kiểm kê doanh nghiệp và nhận diện điểm nóng năng lượng.',
    export: 'Buyer PCF / ISO 14067 cho sản phẩm vật liệu xây dựng xuất khẩu.',
  },
};

export default function DemoIndustryLabClient() {
  const pathname = usePathname();
  const base = isDemoPath(pathname) ? "/demo" : "";
  const toAppPath = (lovablePath: string) => `${base}${lovablePath.replace(/^\/dashboard/, "")}`;
  const sourceMap = useMemo(() => new Map(sources.map((s) => [s.source_key, s])), []);
  const industryLabel = (industry: string) => INDUSTRY_VI[industry] || industry;

  const copy = {
    title: 'Phòng demo theo ngành',
    subtitle: 'Input công nghiệp có nguồn → quy trình WeaveCarbon → đầu ra nội địa & xuất khẩu',
    industries: 'ngành',
    publicInputs: 'Input từ nguồn công khai',
    demoLabel: 'Phép tính demo được gắn nhãn rõ ràng',
    hero: 'Xem rõ từng ngành bắt đầu với dữ liệu nào — và WeaveCarbon biến dữ liệu đó thành đầu ra gì.',
    intro: 'Các input vận hành trên trang này đến từ công bố doanh nghiệp, hệ số chính thức hoặc tài liệu pháp quy. Các phép phân bổ, kịch bản và workflow do WeaveCarbon tạo vẫn là phép tính demo nếu nguồn không xác nhận trực tiếp.',
    sourceInputs: 'input có nguồn',
    sources: 'nguồn',
    loading: 'Đang đồng bộ dữ liệu có nguồn…',
    fallback: 'Snapshot dữ liệu có nguồn tích hợp sẵn',
    live: 'Đã đồng bộ từ Supabase',
    problem: 'Vấn đề trong vận hành',
    domestic: 'Đầu ra Việt Nam / nội bộ',
    export: 'Đầu ra xuất khẩu / buyer',
    realInputs: 'Input công khai thực tế dùng trong demo',
    openWorkflow: 'Mở quy trình',
    metric: 'Chỉ số',
    value: 'Giá trị',
    period: 'Kỳ',
    entity: 'Đơn vị / mức chi tiết',
    useInWeave: 'Cách dùng trong Weave',
    source: 'Nguồn',
    checklist: 'Danh sách input cần có',
    reporting: 'Báo cáo / tiêu chuẩn',
  };

  return (
      <div className="space-y-6">
        <div className="glass-panel rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background/60 to-background/40 p-5 md:p-7">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{useCases.length} {copy.industries}</Badge>
                <Badge variant="outline">{copy.publicInputs}</Badge>
                <Badge variant="outline">{copy.demoLabel}</Badge>
                <Badge variant="outline">{copy.fallback}</Badge>
              </div>
              <h2 className="max-w-3xl font-display text-2xl font-semibold tracking-tight md:text-3xl">{copy.hero}</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{copy.intro}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="interactive-surface rounded-xl border bg-card/70 p-3"><div className="font-display text-2xl font-semibold tabular-nums">{useCases.length}</div><div className="text-[11px] text-muted-foreground">{copy.industries}</div></div>
              <div className="interactive-surface rounded-xl border bg-card/70 p-3"><div className="font-display text-2xl font-semibold tabular-nums">{inputs.length}</div><div className="text-[11px] text-muted-foreground">{copy.sourceInputs}</div></div>
              <div className="interactive-surface rounded-xl border bg-card/70 p-3"><div className="font-display text-2xl font-semibold tabular-nums">{sources.length}</div><div className="text-[11px] text-muted-foreground">{copy.sources}</div></div>
            </div>
          </div>
        </div>

        
        <Tabs defaultValue={useCases[0]?.industry || 'Steel'} className="w-full">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
            {useCases.map((item) => <TabsTrigger key={item.industry} value={item.industry} className="whitespace-nowrap">{industryLabel(item.industry)}</TabsTrigger>)}
          </TabsList>

          {useCases.map((item) => {
            const industryInputs = inputs.filter((input) => input.industry === item.industry || input.industry === 'Cross-industry');
            const translatedUseCase = USE_CASE_VI[item.industry];
            return (
              <TabsContent key={item.industry} value={item.industry} className="mt-5 space-y-5">
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Factory className="h-4 w-4 text-primary" />{copy.problem}</CardTitle></CardHeader>
                    <CardContent className="text-sm leading-6 text-muted-foreground">{translatedUseCase ? translatedUseCase.problem : item.primary_problem}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" />{copy.domestic}</CardTitle></CardHeader>
                    <CardContent className="text-sm leading-6 text-muted-foreground">{translatedUseCase ? translatedUseCase.domestic : item.domestic_output}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Layers3 className="h-4 w-4 text-primary" />{copy.export}</CardTitle></CardHeader>
                    <CardContent className="text-sm leading-6 text-muted-foreground">{translatedUseCase ? translatedUseCase.export : item.export_output}</CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <CardTitle className="flex items-center gap-2 text-base"><Gauge className="h-4 w-4 text-primary" />{copy.realInputs}</CardTitle>
                      <Button asChild size="sm"><Link href={toAppPath(item.demo_path)} prefetch={false}>{copy.openWorkflow}</Link></Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                          <tr><th className="py-3 pr-4">{copy.metric}</th><th className="py-3 pr-4">{copy.value}</th><th className="py-3 pr-4">{copy.period}</th><th className="py-3 pr-4">{copy.entity}</th><th className="py-3 pr-4">{copy.useInWeave}</th><th className="py-3">{copy.source}</th></tr>
                        </thead>
                        <tbody>
                          {industryInputs.map((input) => {
                            const source = sourceMap.get(input.source_key);
                            return (
                              <tr key={input.id} className="border-b align-top last:border-0">
                                <td className="py-3 pr-4 font-medium">{translateDemoText(input.metric, true)}<div className="mt-1 text-xs font-normal text-muted-foreground">{input.accounting_scope}</div></td>
                                <td className="py-3 pr-4 whitespace-nowrap"><span className="font-semibold">{formatValue(input.value)}</span> <span className="text-muted-foreground">{input.unit}</span></td>
                                <td className="py-3 pr-4">{input.reporting_period}</td>
                                <td className="py-3 pr-4 text-muted-foreground">{translateDemoText(input.source_entity, true)}<div className="mt-1 text-xs">{translateDemoText(input.source_granularity, true)}</div></td>
                                <td className="py-3 pr-4 text-muted-foreground">{translateDemoText(input.use_case, true)}</td>
                                <td className="py-3">{source ? <a className="inline-flex items-center gap-1 text-primary hover:underline" href={source.source_url} target="_blank" rel="noreferrer">{source.publisher}<ExternalLink className="h-3 w-3" /></a> : input.source_key}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-base">{copy.checklist}</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">{item.input_groups.map((v) => <Badge key={v} variant="outline">{translateDemoText(v, true)}</Badge>)}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4 text-primary" />{copy.reporting}</CardTitle></CardHeader>
                    <CardContent className="flex flex-wrap gap-2">{item.standards.map((v) => <Badge key={v} variant="secondary">{v}</Badge>)}</CardContent>
                  </Card>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
  );
}
