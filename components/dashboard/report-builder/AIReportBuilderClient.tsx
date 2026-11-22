/* eslint-disable @typescript-eslint/no-explicit-any -- ported 1:1 from the Lovable demo data layer (schemaless snapshot rows); typed at the module boundary. */
'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isDemoPath } from '@/lib/demo/routes';
import {
  AlertTriangle,
  Bot,
  Boxes,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Database,
  Download,
  ExternalLink,
  Factory,
  FileCheck2,
  FileText,
  FlaskConical,
  GitBranch,
  Loader2,
  Package,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react';
import PageHeader from '@/components/app/PageHeader';
import StatCard from '@/components/app/StatCard';
import SectionCard from '@/components/app/SectionCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getIndustrialPortfolio } from '@/lib/industrialPortfolio/dataset';
import { getIndustrialReporting } from '@/lib/industrialPortfolio/reporting';
import {
  legalMarketProfiles,
  reportingIndustries,
  REPORTING_REGISTRY_REVIEW_DATE,
  type ReportingIndustry,
} from '@/lib/industrialPortfolio/legalMarketRegistry';
import {
  demoProductionBatches,
  demoShipmentScopes,
  reportDemoScenarios,
  reportMonths2026,
  reportQuarterOptions,
  reportYearOptions,
  type ReportEntityType,
  type ReportPeriodType,
} from '@/lib/industrialPortfolio/reportScopeDemo';
import {
  buildScopedIndustryReport,
  type GeneratedScopedIndustryReport,
  type ReportScopeSelection,
} from '@/lib/industrialPortfolio/engine/scopedIndustryReportEngine';
import { defaultProfileForIndustry, type ReportCheckLevel } from '@/lib/industrialPortfolio/engine/aiMonthlyReportEngine';
import { exportGeneratedReportPdf } from '@/lib/industrialPortfolio/engine/generatedReportPdf';
import { exportGeneratedReportXlsx } from '@/lib/industrialPortfolio/reportExport';
import { useAppLanguage } from '@/lib/i18n/appLanguage';

const industryLabel = (industry: ReportingIndustry, vi: boolean) => vi ? ({
  Agriculture: 'Nông nghiệp & nông sản',
  Steel: 'Thép',
  Cement: 'Xi măng',
  'Construction Materials': 'Vật liệu xây dựng',
  Aluminium: 'Nhôm',
  Chemicals: 'Phân bón & hóa chất',
  'Mining & Minerals': 'Khai khoáng & khoáng sản',
}[industry] || industry) : industry;

const entityLabels: Record<ReportEntityType, [string, string]> = {
  industry: ['Toàn Industry Pack', 'Whole Industry Pack'],
  facility: ['Cơ sở sản xuất', 'Facility'],
  product: ['Sản phẩm', 'Product'],
  batch: ['Lô sản xuất', 'Production batch'],
  shipment: ['Lô vận chuyển', 'Shipment'],
};

const entityIcons: Record<ReportEntityType, React.ComponentType<{ className?: string }>> = {
  industry: GitBranch,
  facility: Factory,
  product: Package,
  batch: Boxes,
  shipment: Truck,
};

const generationStepsVi = [
  'Resolve đối tượng + kỳ báo cáo',
  'Thu thập snapshot đúng scope',
  'Đối chiếu completeness, evidence & data gaps',
  'Double-check Industry Pack, thị trường & profile',
  'Khóa calculation context, factor/GWP & allocation',
  'AI dựng narrative + human review gate',
];
const generationStepsEn = [
  'Resolve reporting object + period',
  'Collect the exact in-scope snapshot',
  'Cross-check completeness, evidence & data gaps',
  'Double-check Industry Pack, market & profile',
  'Lock calculation context, factors/GWP & allocation',
  'AI drafts narrative + human review gate',
];

const checkTone: Record<ReportCheckLevel, string> = {
  pass: 'border-primary/20 bg-primary/5 text-primary',
  warning: 'border-warning/30 bg-warning/10 text-foreground',
  blocker: 'border-destructive/25 bg-destructive/10 text-destructive',
  info: 'border-info/25 bg-info/10 text-info',
};
const checkIcon = (level: ReportCheckLevel) => level === 'pass' ? CheckCircle2 : level === 'info' ? ShieldCheck : AlertTriangle;

const AIReportBuilderClient: React.FC = () => {
  const appLanguage = useAppLanguage();
  const vi = appLanguage === 'vi';
  const router = useRouter();
  const pathname = usePathname();
  const demo = isDemoPath(pathname);
  const base = demo ? '/demo' : '';
  const navigate = (lovablePath: string) => router.push(`${base}${lovablePath.replace(/^\/dashboard/, '')}`);
  const dataset = getIndustrialPortfolio();
  const reporting = getIndustrialReporting();

  const [industry, setIndustry] = useState<ReportingIndustry>('Steel');
  const [entityType, setEntityType] = useState<ReportEntityType>('industry');
  const [entityId, setEntityId] = useState('');
  const [periodType, setPeriodType] = useState<ReportPeriodType>('month');
  const [periodKey, setPeriodKey] = useState('Aug 2026');
  const initialProfile = defaultProfileForIndustry('Steel', legalMarketProfiles);
  const [profileCode, setProfileCode] = useState(initialProfile.code);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingXlsx, setIsExportingXlsx] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [generated, setGenerated] = useState<GeneratedScopedIndustryReport | null>(null);

  const profiles = useMemo(() => {
    const matched = legalMarketProfiles.filter((profile) => profile.applicableIndustries.includes(industry));
    return matched.length ? matched : [defaultProfileForIndustry(industry, legalMarketProfiles)];
  }, [industry]);
  const profile = profiles.find((item) => item.code === profileCode) || profiles[0];
  const steps = vi ? generationStepsVi : generationStepsEn;

  const entityOptions = useMemo(() => {
    if (entityType === 'facility') {
      return dataset.facilities.filter((item: any) => item.industry === industry).map((item: any) => ({ id: item.id, label: item.name }));
    }
    if (entityType === 'product') {
      return reporting.products.filter((item) => item.industry === industry).map((item) => ({ id: item.id, label: `${item.name}${item.productCode ? ` · ${item.productCode}` : ''}` }));
    }
    if (entityType === 'batch') {
      return demoProductionBatches.filter((item) => item.industry === industry).map((item) => ({ id: item.id, label: `${item.name} · ${item.quantity.toLocaleString()} ${item.unit}` }));
    }
    if (entityType === 'shipment') {
      return demoShipmentScopes.filter((item) => item.industry === industry).map((item) => ({ id: item.id, label: item.name }));
    }
    return [];
  }, [dataset.facilities, reporting.products, industry, entityType]);

  const linkedPeriod = useMemo(() => {
    if (entityType === 'batch') return demoProductionBatches.find((item) => item.id === entityId)?.period;
    if (entityType === 'shipment') return demoShipmentScopes.find((item) => item.id === entityId)?.period;
    return undefined;
  }, [entityType, entityId]);

  const periodSelection = useMemo<ReportScopeSelection>(() => {
    if (linkedPeriod) {
      return { entityType, entityId, periodType: 'month', periodKey: linkedPeriod, periodLabel: linkedPeriod, periodLabels: [linkedPeriod] };
    }
    if (periodType === 'quarter') {
      const option = reportQuarterOptions.find((item) => item.key === periodKey) || reportQuarterOptions.at(-1)!;
      return { entityType, entityId, periodType, periodKey: option.key, periodLabel: option.label, periodLabels: [...option.periods] };
    }
    if (periodType === 'year') {
      const option = reportYearOptions.find((item) => item.key === periodKey) || reportYearOptions[0];
      return { entityType, entityId, periodType, periodKey: option.key, periodLabel: option.label, periodLabels: [...option.periods] };
    }
    const month = reportMonths2026.includes(periodKey as any) ? periodKey : 'Aug 2026';
    return { entityType, entityId, periodType: 'month', periodKey: month, periodLabel: month, periodLabels: [month] };
  }, [entityType, entityId, periodType, periodKey, linkedPeriod]);

  const selectedEntityLabel = entityType === 'industry'
    ? industryLabel(industry, vi)
    : entityOptions.find((item) => item.id === entityId)?.label || (vi ? 'Chưa chọn đối tượng' : 'No object selected');

  const changeIndustry = (value: string) => {
    const nextIndustry = value as ReportingIndustry;
    const nextProfile = defaultProfileForIndustry(nextIndustry, legalMarketProfiles);
    setIndustry(nextIndustry);
    setProfileCode(nextProfile.code);
    setEntityType('industry');
    setEntityId('');
    setGenerated(null);
    setActiveStep(-1);
  };

  const changeEntityType = (value: string) => {
    const next = value as ReportEntityType;
    setEntityType(next);
    setEntityId('');
    setGenerated(null);
    setActiveStep(-1);
  };

  const changePeriodType = (next: ReportPeriodType) => {
    setPeriodType(next);
    setPeriodKey(next === 'month' ? 'Aug 2026' : next === 'quarter' ? 'Q3-2026-YTD' : '2026-YTD');
    setGenerated(null);
  };

  const resolvePreferredProfile = (nextIndustry: ReportingIndustry, requested?: string) => {
    const allowed = legalMarketProfiles.filter((item) => item.applicableIndustries.includes(nextIndustry));
    if (requested) {
      const exact = allowed.find((item) => item.code === requested) || allowed.find((item) => item.reportProfileCode === requested);
      if (exact) return exact;
    }
    return defaultProfileForIndustry(nextIndustry, legalMarketProfiles);
  };

  const runGenerate = (config?: {
    industry?: ReportingIndustry;
    entityType?: ReportEntityType;
    entityId?: string;
    periodType?: ReportPeriodType;
    periodKey?: string;
    profileCode?: string;
  }) => {
    const nextIndustry = config?.industry || industry;
    const nextEntityType = config?.entityType || entityType;
    const nextEntityId = config?.entityId ?? entityId;
    const nextPeriodType = config?.periodType || periodType;
    const nextPeriodKey = config?.periodKey || periodKey;
    let selection: ReportScopeSelection;
    const nextBatch = nextEntityType === 'batch' ? demoProductionBatches.find((item) => item.id === nextEntityId) : undefined;
    const nextShipment = nextEntityType === 'shipment' ? demoShipmentScopes.find((item) => item.id === nextEntityId) : undefined;
    const fixedPeriod = nextBatch?.period || nextShipment?.period;
    if (fixedPeriod) {
      selection = { entityType: nextEntityType, entityId: nextEntityId, periodType: 'month', periodKey: fixedPeriod, periodLabel: fixedPeriod, periodLabels: [fixedPeriod] };
    } else if (nextPeriodType === 'quarter') {
      const option = reportQuarterOptions.find((item) => item.key === nextPeriodKey) || reportQuarterOptions.at(-1)!;
      selection = { entityType: nextEntityType, entityId: nextEntityId, periodType: nextPeriodType, periodKey: option.key, periodLabel: option.label, periodLabels: [...option.periods] };
    } else if (nextPeriodType === 'year') {
      const option = reportYearOptions.find((item) => item.key === nextPeriodKey) || reportYearOptions[0];
      selection = { entityType: nextEntityType, entityId: nextEntityId, periodType: nextPeriodType, periodKey: option.key, periodLabel: option.label, periodLabels: [...option.periods] };
    } else {
      const month = reportMonths2026.includes(nextPeriodKey as any) ? nextPeriodKey : 'Aug 2026';
      selection = { entityType: nextEntityType, entityId: nextEntityId, periodType: 'month', periodKey: month, periodLabel: month, periodLabels: [month] };
    }

    const selectedProfile = resolvePreferredProfile(nextIndustry, config?.profileCode || profileCode);
    setGenerated(null);
    setIsGenerating(true);
    setActiveStep(0);
    steps.forEach((_, index) => {
      window.setTimeout(() => {
        setActiveStep(index);
        if (index === steps.length - 1) {
          setGenerated(buildScopedIndustryReport({
            dataset,
            reporting,
            profile: selectedProfile,
            industry: nextIndustry,
            selection,
            vi,
            demo: true,
          }));
          setIsGenerating(false);
        }
      }, 300 * index);
    });
  };

  const applyScenario = (scenario: typeof reportDemoScenarios[number]) => {
    const preferredCode = scenario.industry === 'Agriculture'
      ? 'ISO_14067'
      : ['Steel', 'Cement', 'Aluminium', 'Chemicals'].includes(scenario.industry) ? 'EU_CBAM_2026' : undefined;
    const selectedProfile = resolvePreferredProfile(scenario.industry, preferredCode);
    setIndustry(scenario.industry);
    setEntityType(scenario.entityType);
    setEntityId(scenario.entityId || '');
    setPeriodType(scenario.periodType);
    setPeriodKey(scenario.periodKey);
    setProfileCode(selectedProfile.code);
    runGenerate({ ...scenario, profileCode: selectedProfile.code });
  };

  const downloadPdf = async () => {
    if (!generated || isExporting) return;
    setIsExporting(true);
    try { await exportGeneratedReportPdf(generated, vi); } finally { setIsExporting(false); }
  };

  const downloadXlsx = async () => {
    if (!generated || isExportingXlsx) return;
    setIsExportingXlsx(true);
    try { await exportGeneratedReportXlsx(generated, vi); } finally { setIsExportingXlsx(false); }
  };

  const scopeReady = entityType === 'industry' || Boolean(entityId);
  const blockers = generated?.checks.filter((check) => check.level === 'blocker').length || 0;
  const warnings = generated?.checks.filter((check) => check.level === 'warning').length || 0;
  const readiness = generated
    ? generated.status === 'verification-ready' ? 100 : generated.status === 'needs-review' ? 75 : 45
    : dataset.emissionsSummary.readinessPct;

  // The builder still runs on the 2026 demonstration dataset (Lovable port) and does not read
  // tenant data yet, so a real account gets an explanation instead of demo figures.
  if (!demo) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={vi ? 'AI Report Builder' : 'AI Report Builder'}
          description={vi
            ? 'Dựng báo cáo theo đúng phạm vi đối tượng và kỳ dữ liệu.'
            : 'Build reports for an exact reporting object and period.'}
        />
        <SectionCard title={vi ? 'Đang chạy trên dữ liệu minh họa' : 'Runs on demonstration data'}>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">{vi
              ? 'Trình dựng báo cáo này hiện chỉ dùng bộ dữ liệu minh họa 2026 và chưa đọc dữ liệu của doanh nghiệp bạn, nên được tắt trong tài khoản thật để không nhầm với số liệu thật. Để lập báo cáo từ dữ liệu của doanh nghiệp, hãy dùng trang Báo cáo.'
              : 'This builder currently uses the 2026 demonstration dataset only and does not read your company data yet, so it is turned off in real accounts to avoid mixing it up with real figures. Use the Reports page to report on your own data.'}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => router.push('/reports')}>
                <FileText className="mr-2 h-4 w-4" />{vi ? 'Mở trang Báo cáo' : 'Open Reports'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => router.push('/demo/report-builder')}>
                <FlaskConical className="mr-2 h-4 w-4" />{vi ? 'Xem thử trong bản demo' : 'Try it in the demo'}
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={vi ? 'AI Report Builder — Tổng hợp theo đúng phạm vi' : 'AI Report Builder — Scope-aware reporting'}
        description={vi
          ? 'Chọn độc lập đối tượng báo cáo và khoảng thời gian: toàn ngành, cơ sở, sản phẩm, lô sản xuất hoặc shipment; theo tháng, quý hoặc YTD. WeaveCarbon resolve lineage trước, sau đó mới tổng hợp dữ liệu và áp dụng report contract theo ngành/thị trường.'
          : 'Choose reporting object and time window independently: industry, facility, product, production batch or shipment; monthly, quarterly or YTD. WeaveCarbon resolves lineage first, then aggregates data and applies the industry/market report contract.'}
        meta={<div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline"><Database className="mr-1.5 h-3.5 w-3.5" />Demo snapshot</Badge>
          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100"><FlaskConical className="mr-1.5 h-3.5 w-3.5" />DEMO DATA</Badge>
          <Badge variant="outline"><Scale className="mr-1.5 h-3.5 w-3.5" />Registry {REPORTING_REGISTRY_REVIEW_DATE}</Badge>
        </div>}
        actions={<Button variant="outline" size="sm" onClick={() => navigate('/dashboard/reports/registry')}><ExternalLink className="mr-2 h-4 w-4" />{vi ? 'Registry pháp lý / thị trường' : 'Legal / market registry'}</Button>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Activity data" value={String(dataset.activityData.length)} subtext={vi ? 'Bản ghi nguồn, không bị report sửa' : 'Source records; reports never mutate them'} />
        <StatCard label={vi ? 'Bằng chứng' : 'Evidence'} value={String(reporting.evidence.length)} subtext={vi ? 'Evidence records có lineage' : 'Evidence records with lineage'} />
        <StatCard label={vi ? 'Đối tượng report' : 'Report objects'} value="5" subtext={vi ? 'Industry · facility · product · batch · shipment' : 'Industry · facility · product · batch · shipment'} />
        <StatCard label={vi ? 'Readiness hiện tại' : 'Current readiness'} value={`${readiness}%`} subtext={generated ? `${blockers} blocker · ${warnings} warning` : (vi ? 'Trước human review' : 'Before human review')} />
      </div>

      <SectionCard
        title={vi ? '1. Khóa phạm vi báo cáo' : '1. Lock the reporting scope'}
        description={vi ? 'Thời gian và đối tượng là hai chiều riêng. Cùng một Carbon Evidence Graph được tái sử dụng nhưng chỉ các record thuộc scope mới đi vào snapshot.' : 'Time and reporting object are independent dimensions. The same Carbon Evidence Graph is reused, but only in-scope records enter the snapshot.'}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Ngành / Industry Pack' : 'Industry / Industry Pack'}</p>
            <Select value={industry} onValueChange={changeIndustry}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reportingIndustries.map((item) => <SelectItem key={item} value={item}>{industryLabel(item, vi)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Báo cáo theo' : 'Report by'}</p>
            <Select value={entityType} onValueChange={changeEntityType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(entityLabels) as ReportEntityType[]).map((item) => <SelectItem key={item} value={item}>{vi ? entityLabels[item][0] : entityLabels[item][1]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Đối tượng cụ thể' : 'Specific object'}</p>
            {entityType === 'industry'
              ? <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3 text-sm">{industryLabel(industry, vi)}</div>
              : <Select value={entityId} onValueChange={(value) => { setEntityId(value); setGenerated(null); }}><SelectTrigger><SelectValue placeholder={vi ? 'Chọn đối tượng' : 'Select object'} /></SelectTrigger><SelectContent>{entityOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select>}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Kiểu kỳ' : 'Period type'}</p>
            {linkedPeriod
              ? <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3 text-sm"><CalendarDays className="mr-2 h-4 w-4" />{vi ? 'Theo kỳ của lô / shipment' : 'Linked batch / shipment period'}</div>
              : <div className="flex gap-2">{(['month', 'quarter', 'year'] as ReportPeriodType[]).map((item) => <Button key={item} type="button" size="sm" variant={periodType === item ? 'default' : 'outline'} onClick={() => changePeriodType(item)}>{item === 'month' ? (vi ? 'Tháng' : 'Month') : item === 'quarter' ? (vi ? 'Quý' : 'Quarter') : 'YTD'}</Button>)}</div>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Kỳ dữ liệu' : 'Data period'}</p>
            {linkedPeriod
              ? <div className="flex h-10 items-center rounded-md border border-border bg-muted/20 px-3 text-sm">{linkedPeriod}</div>
              : periodType === 'month'
                ? <Select value={periodKey} onValueChange={(value) => { setPeriodKey(value); setGenerated(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reportMonths2026.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                : periodType === 'quarter'
                  ? <Select value={periodKey} onValueChange={(value) => { setPeriodKey(value); setGenerated(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reportQuarterOptions.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select>
                  : <Select value={periodKey} onValueChange={(value) => { setPeriodKey(value); setGenerated(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reportYearOptions.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select>}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Profile thị trường / tiêu chuẩn' : 'Market / standard profile'}</p>
            <Select value={profile.code} onValueChange={(value) => { setProfileCode(value); setGenerated(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{profiles.map((item) => <SelectItem key={item.code} value={item.code}>{vi ? item.titleVi : item.titleEn} · {item.market}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-primary/20 bg-secondary/35 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{vi ? entityLabels[entityType][0] : entityLabels[entityType][1]}</Badge><Badge variant="outline">{periodSelection.periodLabel}</Badge><Badge variant="outline">{vi ? profile.titleVi : profile.titleEn}</Badge></div>
              <p className="mt-3 font-semibold">{selectedEntityLabel}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vi ? 'Scope lineage được resolve trước khi aggregation. Report không lấy dữ liệu ngoài đối tượng/kỳ đã chọn và không sửa bản ghi nguồn.' : 'Scope lineage is resolved before aggregation. The report excludes out-of-scope records and never mutates source data.'}</p>
            </div>
            <Button size="lg" disabled={!scopeReady || dataset.loading || reporting.loading || isGenerating} onClick={() => runGenerate()}>{isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{isGenerating ? (vi ? 'Đang resolve & double-check…' : 'Resolving & double-checking…') : (vi ? 'Tạo report theo scope' : 'Generate scoped report')}</Button>
          </div>
        </div>
      </SectionCard>

      <div className="my-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <SectionCard title={vi ? '2. Scope orchestration + kiểm tra chéo' : '2. Scope orchestration + cross-check'} description={vi ? 'AI nằm trên data layer; Carbon Engine và Evidence Graph vẫn là nguồn số liệu.' : 'AI sits above the data layer; the Carbon Engine and Evidence Graph remain the source of truth.'}>
          <div className="space-y-3">{steps.map((step, index) => {
            const done = generated ? true : index < activeStep;
            const active = isGenerating && index === activeStep;
            return <div key={step} className={cn('flex items-center gap-3 rounded-xl border p-3 transition-all', done && 'border-emerald-200 bg-emerald-50/70', active && 'border-primary bg-secondary/60 shadow-sm')}>
              <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold', done ? 'border-emerald-500 bg-emerald-500 text-white' : active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground')}>{done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : index + 1}</span>
              <div><p className="text-sm font-medium">{step}</p><p className="text-xs text-muted-foreground">{index === 0 ? 'Industry → facility → product → batch → shipment + period' : index === 1 ? 'Activity · process · product · evidence · cadence' : index === 2 ? 'Missing · proxy · reconciliation · evidence coverage' : index === 3 ? 'Vietnam · GHG · ISO · CBAM · buyer / DPP readiness' : index === 4 ? 'Factor snapshot · GWP · allocation · version' : (vi ? 'Narrative + pre-issue gate + human approval' : 'Narrative + pre-issue gate + human approval')}</p></div>
            </div>;
          })}</div>
        </SectionCard>

        <SectionCard title={vi ? '3. Pre-issue gate' : '3. Pre-issue gate'} description={vi ? 'Blocker không làm mất dữ liệu. Nó chỉ giữ report ở Draft và chỉ ra phần cần bổ sung.' : 'Blockers never remove data. They only keep the report in Draft and identify what must be completed.'}>
          {!generated ? <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center"><Bot className="mb-4 h-8 w-8 text-primary"/><p className="font-medium">{vi ? 'Sẵn sàng resolve scope' : 'Ready to resolve scope'}</p><p className="mt-1 max-w-md text-sm text-muted-foreground">{vi ? 'Chọn đối tượng + kỳ + report profile. WeaveCarbon sẽ khóa lineage trước khi dựng report.' : 'Choose object + period + report profile. WeaveCarbon locks lineage before building the report.'}</p></div> : <div className="space-y-2">{generated.checks.map((check) => { const Icon = checkIcon(check.level); return <div key={check.id} className={cn('rounded-xl border p-3.5', checkTone[check.level])}><div className="flex items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0"/><div><p className="text-sm font-semibold">{check.label}</p><p className="mt-1 text-xs leading-relaxed opacity-90">{check.detail}</p></div></div></div>; })}</div>}
        </SectionCard>
      </div>

      {generated && <SectionCard
        title={vi ? '4. Report hoàn chỉnh theo scope' : '4. Complete scope-aware report'}
        description={`${generated.id} · ${generated.profileTitle}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={downloadXlsx} disabled={isExportingXlsx}>
              {isExportingXlsx ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {vi ? 'Tải Excel' : 'Download Excel'}
            </Button>
            <Button size="sm" onClick={downloadPdf} disabled={isExporting}>
              {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {vi ? 'Tải PDF' : 'Download PDF'}
            </Button>
          </div>
        }
      >
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div><div className="flex flex-wrap gap-2">{demo ? null : <Badge className="bg-amber-200 text-amber-950 hover:bg-amber-200">DEMO — NOT FOR FILING</Badge>}<Badge variant="outline">{generated.status}</Badge><Badge variant="outline">{vi ? entityLabels[generated.scope.entityType][0] : entityLabels[generated.scope.entityType][1]}</Badge></div><h2 className="mt-3 text-2xl font-semibold tracking-tight">{generated.title}</h2><p className="mt-1 text-sm text-muted-foreground">{generated.subtitle}</p><p className="mt-3 text-xs text-muted-foreground"><GitBranch className="mr-1.5 inline h-3.5 w-3.5" />{generated.scope.lineage.join(' → ')}</p></div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">tCO₂e</p><p className="font-semibold">{generated.metrics.emissionsTco2e.toLocaleString('en-US',{maximumFractionDigits:1})}</p></div><div><p className="text-xs text-muted-foreground">Data quality</p><p className="font-semibold">{generated.metrics.dataQualityPct}%</p></div><div><p className="text-xs text-muted-foreground">Evidence</p><p className="font-semibold">{generated.metrics.evidenceCoveragePct}%</p></div><div><p className="text-xs text-muted-foreground">Findings</p><p className="font-semibold">{generated.metrics.openFindings}</p></div></div>
          </div>
        </div>
        <article className="mx-auto max-w-5xl space-y-5">{generated.sections.map((section) => <section key={section.id} className="rounded-xl border border-border bg-background p-5"><h3 className="text-lg font-semibold">{section.title}</h3><div className="mt-3 space-y-2 text-sm leading-7 text-muted-foreground">{section.body.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>{section.facts?.length ? <div className="mt-4 overflow-hidden rounded-lg border border-border"><table className="w-full text-sm"><tbody className="divide-y divide-border">{section.facts.map((fact, index) => <tr key={`${fact.label}-${index}`}><td className="w-[34%] bg-muted/30 px-3 py-2 font-medium text-foreground">{fact.label}</td><td className="px-3 py-2 text-muted-foreground">{fact.value}</td></tr>)}</tbody></table></div> : null}</section>)}</article>
        <div className="mt-6 rounded-xl border border-primary/20 bg-secondary/40 p-4"><div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 text-primary"/><div><p className="text-sm font-semibold">{vi ? 'Nguyên tắc aggregation' : 'Aggregation rule'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vi ? 'Phát thải kỳ được cộng từ các record/tháng trong scope. Carbon intensity không average đơn giản giữa các tháng; product/batch dùng quantity × governed intensity/allocation. Shipment tách embodied carbon và logistics trước khi tổng hợp.' : 'Period emissions are summed from in-scope records/months. Carbon intensity is never a simple average of monthly intensities; product/batch scopes use quantity × governed intensity/allocation. Shipment scope keeps embodied carbon and logistics separate before aggregation.'}</p></div></div></div>
      </SectionCard>}

      <SectionCard className="mt-6" title={vi ? '5. Kịch bản báo cáo có sẵn' : '5. Ready-made report scenarios'} description={vi ? 'Các kịch bản dùng chung bộ dữ liệu công nghiệp & nông nghiệp 2026. Bấm để khóa phạm vi và dựng báo cáo ngay.' : 'These scenarios share the 2026 industrial & agriculture dataset. Click to lock scope and generate immediately.'}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{reportDemoScenarios.map((scenario) => {
          const Icon = entityIcons[scenario.entityType];
          return <button key={scenario.id} onClick={() => applyScenario(scenario)} className="group rounded-2xl border border-border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"><div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary"/><Badge variant="outline">{industryLabel(scenario.industry, vi)}</Badge></div><h3 className="mt-3 font-semibold">{vi ? scenario.labelVi : scenario.labelEn}</h3><p className="mt-1 text-xs text-muted-foreground">{vi ? entityLabels[scenario.entityType][0] : entityLabels[scenario.entityType][1]}</p></div><ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"/></div><div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-4 w-4"/>{vi ? 'Dữ liệu demo 2026 · cùng Evidence Graph' : '2026 demo data · same Evidence Graph'}</div></button>;
        })}</div>
      </SectionCard>

      <div className="mt-6 rounded-2xl border border-primary/20 bg-secondary/40 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary"/><p className="font-semibold">{vi ? 'Luồng chuẩn cho dữ liệu thật' : 'Production workflow'}</p></div><p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">{vi ? 'Input theo tháng → Validate → Evidence → Calculate → Freeze snapshot → chọn Entity + Period → Resolve lineage → Aggregate → Apply market adapter → AI narrative → Human review → Issue. Không có bước nào của Report Builder được phép tự sửa dữ liệu nguồn.' : 'Monthly input → Validate → Evidence → Calculate → Freeze snapshot → choose Entity + Period → Resolve lineage → Aggregate → Apply market adapter → AI narrative → Human review → Issue. No Report Builder step is allowed to mutate source data.'}</p></div><Button variant="outline" onClick={() => navigate('/dashboard/activity-data')}>{vi ? 'Đi tới dữ liệu hoạt động' : 'Open activity data'}<ChevronRight className="ml-2 h-4 w-4"/></Button></div></div>
    </div>
  );
};

export default AIReportBuilderClient;
