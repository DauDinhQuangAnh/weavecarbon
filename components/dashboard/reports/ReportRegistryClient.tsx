/* eslint-disable @typescript-eslint/no-explicit-any -- ported from the Lovable reporting center */
'use client';

import React, { useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isDemoPath } from '@/lib/demo/routes';
import PageHeader from '@/components/app/PageHeader';
import StatCard from '@/components/app/StatCard';
import SectionCard from '@/components/app/SectionCard';
import StatusPill from '@/components/app/StatusPill';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  Globe2,
  Scale,
  ShieldCheck,
  FlaskConical,
  Building2,
  PackageCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useAppLanguage } from '@/lib/i18n/appLanguage';
import { getIndustrialPortfolio } from '@/lib/industrialPortfolio/dataset';
import { getIndustrialReporting, type ReportProfileRow } from '@/lib/industrialPortfolio/reporting';
import { exportIndustrialReportProfile } from '@/lib/industrialPortfolio/reportExport';
import {
  legalMarketProfiles,
  reportingIndustries,
  REPORTING_REGISTRY_REVIEW_DATE,
  type LegalMarketProfile,
  type LegalNature,
} from '@/lib/industrialPortfolio/legalMarketRegistry';

const natureTone: Record<LegalNature, string> = {
  regulatory: 'border-destructive/25 bg-destructive/10 text-destructive',
  standard: 'border-info/25 bg-info/10 text-info',
  contractual: 'border-warning/30 bg-warning/10 text-foreground',
  readiness: 'border-primary/20 bg-primary/5 text-primary',
};

const natureLabel = (nature: LegalNature, vi: boolean) => ({
  regulatory: vi ? 'Pháp lý / bắt buộc khi thuộc phạm vi' : 'Regulatory / mandatory when in scope',
  standard: vi ? 'Tiêu chuẩn hạch toán' : 'Accounting standard',
  contractual: vi ? 'Yêu cầu buyer / hợp đồng' : 'Buyer / contractual',
  readiness: vi ? 'Readiness / chưa phải filing chung' : 'Readiness / not a universal filing',
}[nature]);

const marketLabel = (market: string, vi: boolean) => ({
  Vietnam: vi ? 'Việt Nam' : 'Vietnam',
  'European Union': vi ? 'Liên minh Châu Âu' : 'European Union',
  Global: vi ? 'Toàn cầu' : 'Global',
  'Buyer / Contract': vi ? 'Buyer / hợp đồng' : 'Buyer / Contract',
}[market] || market);

const industryLabel = (industry: string, vi: boolean) => vi ? ({
  Agriculture: 'Nông nghiệp & nông sản',
  Steel: 'Thép',
  Cement: 'Xi măng',
  'Construction Materials': 'Vật liệu xây dựng',
  Aluminium: 'Nhôm',
  Chemicals: 'Phân bón & hóa chất',
  'Mining & Minerals': 'Khai khoáng & khoáng sản',
}[industry] || industry) : industry;

const toReportProfile = (profile: LegalMarketProfile): ReportProfileRow => ({
  profileCode: profile.reportProfileCode,
  profileName: profile.titleEn,
  marketGroup: profile.market,
  frameworkFamily: profile.nature === 'regulatory' ? 'Regulatory' : profile.nature === 'standard' ? 'Standard' : profile.nature === 'contractual' ? 'Buyer-specific' : 'Readiness',
  scopeLevel: profile.scopeEn,
  applicableIndustries: profile.applicableIndustries,
  requiredDataGroups: profile.requiredDataGroups,
  outputName: profile.titleEn,
  status: profile.nature === 'readiness' ? 'readiness' : 'available',
  reference: profile.references.map((r) => r.label).join('; '),
  notes: profile.officialSubmissionEn,
});

const ReportRegistryClient: React.FC = () => {
  const appLanguage = useAppLanguage();
  const vi = appLanguage === 'vi';
  const router = useRouter();
  const base = isDemoPath(usePathname()) ? '/demo' : '';
  const navigate = (path: string) => router.push(`${base}${path.replace(/^\/dashboard/, '')}`);
  const dataset = getIndustrialPortfolio();
  const reporting = getIndustrialReporting();
  const [industry, setIndustry] = useState('All');
  const [market, setMarket] = useState('All');
  const [selectedCode, setSelectedCode] = useState('VN_GHG_CURRENT');
  const [isExporting, setIsExporting] = useState(false);

  const visibleProfiles = useMemo(() => legalMarketProfiles.filter((profile) => {
    const industryMatch = industry === 'All' || profile.applicableIndustries.includes(industry as any);
    const marketMatch = market === 'All' || profile.market === market;
    return industryMatch && marketMatch;
  }), [industry, market]);

  const selectedProfile = legalMarketProfiles.find((p) => p.code === selectedCode) || visibleProfiles[0] || legalMarketProfiles[0];

  const demoFacilities = useMemo(() => dataset.facilities.filter((f: any) => industry === 'All' || f.industry === industry), [dataset.facilities, industry]);
  const demoProducts = useMemo(() => reporting.products.filter((p) => industry === 'All' || p.industry === industry), [reporting.products, industry]);
  const demoEvidence = useMemo(() => {
    const targets = new Set([selectedProfile.reportProfileCode]);
    return reporting.evidence.filter((e) =>
      e.linkedReportTargets.some((target) => targets.has(target)) &&
      (industry === 'All' || demoProducts.some((p) => p.id === e.productId) || demoFacilities.some((f: any) => f.id === e.facilityId)),
    );
  }, [reporting.evidence, selectedProfile.reportProfileCode, industry, demoProducts, demoFacilities]);

  const demoEmissions = demoFacilities.reduce((sum: number, f: any) => sum + Number(f.tonnes || 0), 0);
  const avgCompleteness = demoFacilities.length
    ? Math.round(demoFacilities.reduce((sum: number, f: any) => sum + Number(f.completeness || 0), 0) / demoFacilities.length)
    : 0;

  const sourceBackedCount = legalMarketProfiles.reduce((sum, profile) => sum + profile.references.length, 0);
  const note = dataset.loading || reporting.loading
    ? (vi ? 'Đang tải dữ liệu demo…' : 'Loading demo data…')
    : (vi
      ? `Khung pháp lý/tiêu chuẩn được version theo nguồn chính thức · dữ liệu doanh nghiệp bên trong là DEMO`
      : 'Legal/standard framework is versioned from authoritative sources · internal business data is DEMO');

  const exportProfile = async (profile: LegalMarketProfile) => {
    if (profile.reportProfileCode === 'EU_CBAM_2026') {
      navigate('/dashboard/cbam-report');
      return;
    }
    const dbProfile = reporting.reportProfiles.find((p) => p.profileCode === profile.reportProfileCode);
    setIsExporting(true);
    try {
      await exportIndustrialReportProfile(dbProfile || toReportProfile(profile), dataset, reporting);
    } catch (err) {
      console.error('Failed to export profile', err);
    } finally {
      setIsExporting(false);
    }
  };

  const sections = vi ? selectedProfile.reportSectionsVi : selectedProfile.reportSectionsEn;

  return (
    <div className="space-y-6">
      <PageHeader
        title={vi ? 'Trung tâm báo cáo pháp lý & thị trường' : 'Legal & Market Reporting Center'}
        description={vi
          ? 'Chọn ngành và thị trường để dựng đúng cấu trúc hồ sơ. Phần tiêu chuẩn/pháp lý dùng nguồn chính thức; số liệu doanh nghiệp, sản phẩm và bằng chứng bên trong được gắn nhãn DEMO và không được trình bày như filing thật.'
          : 'Select an industry and market to build the correct report structure. Legal/standard requirements use authoritative sources; internal company, product and evidence values are labelled DEMO and are never presented as an official filing.'}
        meta={<span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5" />{note}</span>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={vi ? 'Khung thị trường' : 'Market frameworks'} value={String(legalMarketProfiles.length)} subtext={vi ? 'Pháp lý · tiêu chuẩn · buyer · readiness' : 'Regulatory · standards · buyer · readiness'} />
        <StatCard label={vi ? 'Ngành demo' : 'Demo industries'} value={String(reportingIndustries.length)} subtext={vi ? 'Một data backbone · nhiều Industry Pack' : 'One data backbone · multiple Industry Packs'} />
        <StatCard label={vi ? 'Nguồn chuẩn chính thức' : 'Authoritative references'} value={String(sourceBackedCount)} subtext={vi ? `Registry review ${REPORTING_REGISTRY_REVIEW_DATE}` : `Registry reviewed ${REPORTING_REGISTRY_REVIEW_DATE}`} />
        <StatCard label={vi ? 'Phát thải demo danh mục' : 'Demo portfolio emissions'} value={dataset.emissionsSummary.totalTonnes.toLocaleString('vi-VN',{maximumFractionDigits:1})} unit="tCO₂e" subtext={dataset.organization.period} />
      </div>

      <div className="mb-6 grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:grid-cols-[1fr_1fr_auto] lg:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Ngành / Industry Pack' : 'Industry / Industry Pack'}</p>
          <Select value={industry} onValueChange={(value) => { setIndustry(value); const next = legalMarketProfiles.find((p) => (value === 'All' || p.applicableIndustries.includes(value as any)) && (market === 'All' || p.market === market)); if (next) setSelectedCode(next.code); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{vi ? 'Tất cả ngành' : 'All industries'}</SelectItem>
              {reportingIndustries.map((item) => <SelectItem key={item} value={item}>{industryLabel(item, vi)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{vi ? 'Thị trường / phân khúc' : 'Market / segment'}</p>
          <Select value={market} onValueChange={(value) => { setMarket(value); const next = legalMarketProfiles.find((p) => (industry === 'All' || p.applicableIndustries.includes(industry as any)) && (value === 'All' || p.market === value)); if (next) setSelectedCode(next.code); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">{vi ? 'Tất cả thị trường' : 'All markets'}</SelectItem>
              {['Vietnam','European Union','Global','Buyer / Contract'].map((item) => <SelectItem key={item} value={item}>{marketLabel(item, vi)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="h-10 px-3 text-xs"><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />{vi ? 'Ngoài: chuẩn thị trường' : 'External: market standard'}</Badge>
          <Badge className="h-10 bg-amber-100 px-3 text-amber-900 hover:bg-amber-100"><FlaskConical className="mr-1.5 h-3.5 w-3.5" />DEMO DATA</Badge>
        </div>
      </div>

      <SectionCard
        title={vi ? 'Ma trận áp dụng pháp lý & thị trường' : 'Legal & market applicability matrix'}
        description={vi ? 'Tách rõ cái gì là nghĩa vụ pháp lý, cái gì là tiêu chuẩn hạch toán, cái gì là yêu cầu buyer và cái gì mới chỉ ở mức readiness.' : 'Separates legal obligations, accounting standards, buyer requirements and readiness-only layers.'}
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="px-5 py-3">{vi ? 'Hồ sơ' : 'Profile'}</th><th className="px-5 py-3">{vi ? 'Tính chất' : 'Nature'}</th><th className="px-5 py-3">{vi ? 'Phạm vi' : 'Scope'}</th><th className="px-5 py-3">{vi ? 'Ngành áp dụng' : 'Industries'}</th><th className="px-5 py-3">{vi ? 'Nguồn chính thức' : 'Official source'}</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleProfiles.map((profile) => (
                <tr key={profile.code} className={cn('cursor-pointer align-top transition-colors hover:bg-muted/30', selectedProfile.code === profile.code && 'bg-secondary/40')} onClick={() => setSelectedCode(profile.code)}>
                  <td className="px-5 py-4"><p className="font-medium">{vi ? profile.titleVi : profile.titleEn}</p><p className="mt-1 max-w-[340px] text-xs text-muted-foreground">{vi ? profile.shortVi : profile.shortEn}</p></td>
                  <td className="px-5 py-4"><span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium', natureTone[profile.nature])}>{natureLabel(profile.nature, vi)}</span></td>
                  <td className="px-5 py-4 max-w-[320px] text-xs text-muted-foreground">{vi ? profile.scopeVi : profile.scopeEn}</td>
                  <td className="px-5 py-4"><div className="flex max-w-[320px] flex-wrap gap-1">{profile.applicableIndustries.map((item) => <span key={item} className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">{industryLabel(item, vi)}</span>)}</div></td>
                  <td className="px-5 py-4">{profile.references.length ? <a href={profile.references[0].url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">{profile.references[0].label}<ExternalLink className="h-3 w-3" /></a> : <span className="text-xs text-muted-foreground">{vi ? 'Theo hợp đồng buyer' : 'Buyer contract/schema'}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <div className="space-y-6">
          <SectionCard title={vi ? 'Căn cứ & khả năng áp dụng' : 'Basis & applicability'} description={marketLabel(selectedProfile.market, vi)}>
            <div className="space-y-4">
              <div className={cn('rounded-xl border p-4 text-sm', natureTone[selectedProfile.nature])}>
                <p className="font-semibold">{natureLabel(selectedProfile.nature, vi)}</p>
                <p className="mt-2 text-xs leading-relaxed opacity-90">{vi ? selectedProfile.legalStatusVi : selectedProfile.legalStatusEn}</p>
              </div>
              {selectedProfile.industryNoteVi && <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{vi ? selectedProfile.industryNoteVi : selectedProfile.industryNoteEn}</span></div>}
              <div className="space-y-2">{selectedProfile.references.map((ref) => <a key={ref.label} href={ref.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"><div><p className="text-sm font-medium">{ref.label}</p><p className="mt-1 text-xs text-muted-foreground">{vi ? ref.statusVi : ref.statusEn}</p></div><ExternalLink className="mt-0.5 h-4 w-4 text-primary" /></a>)}</div>
            </div>
          </SectionCard>

          <SectionCard title={vi ? 'Ranh giới filing & xác minh' : 'Filing & verification boundary'} description={vi ? 'Không biến gói chuẩn bị thành tuyên bố pháp lý sai.' : 'Do not turn a preparation package into a false legal claim.'}>
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border p-3"><p className="font-medium">{vi ? 'Nộp chính thức' : 'Official submission'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vi ? selectedProfile.officialSubmissionVi : selectedProfile.officialSubmissionEn}</p></div>
              <div className="rounded-lg border border-border p-3"><p className="font-medium">{vi ? 'Xác minh' : 'Verification'}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vi ? selectedProfile.verificationVi : selectedProfile.verificationEn}</p></div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title={vi ? 'Bản xem trước hồ sơ chuẩn — dữ liệu DEMO' : 'Standard report preview — DEMO data'}
          description={vi ? `${industry === 'All' ? 'Danh mục đa ngành' : industryLabel(industry, true)} · ${vi ? selectedProfile.titleVi : selectedProfile.titleEn}` : `${industry === 'All' ? 'Multi-industry portfolio' : industry} · ${selectedProfile.titleEn}`}
          actions={
            <Button size="sm" onClick={() => exportProfile(selectedProfile)} disabled={isExporting}>
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : selectedProfile.reportProfileCode === 'EU_CBAM_2026' ? (
                <ExternalLink className="mr-2 h-4 w-4" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {selectedProfile.reportProfileCode === 'EU_CBAM_2026'
                ? (vi ? 'Mở module CBAM' : 'Open CBAM module')
                : isExporting
                  ? (vi ? 'Đang xuất XLSX…' : 'Exporting XLSX…')
                  : (vi ? 'Xuất gói XLSX' : 'Export XLSX package')}
            </Button>
          }
        >
          <div className="overflow-hidden rounded-2xl border border-border bg-background">
            <div className="border-b border-border bg-[#F4F7F0] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">WEAVECARBON · REPORT PREPARATION PACK</p><h3 className="mt-2 text-xl font-semibold">{vi ? selectedProfile.titleVi : selectedProfile.titleEn}</h3><p className="mt-1 text-sm text-muted-foreground">{dataset.organization.name} · {dataset.organization.period}</p></div>
                <div className="text-right"><Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">DEMO / NOT FOR FILING</Badge><p className="mt-2 text-[11px] text-muted-foreground">Registry review: {REPORTING_REGISTRY_REVIEW_DATE}</p></div>
              </div>
            </div>

            <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-muted/40 p-3"><Building2 className="mb-2 h-4 w-4 text-primary"/><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{vi ? 'Cơ sở' : 'Facilities'}</p><p className="mt-1 text-lg font-semibold">{demoFacilities.length}</p></div>
              <div className="rounded-xl bg-muted/40 p-3"><Scale className="mb-2 h-4 w-4 text-primary"/><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{vi ? 'Phát thải demo' : 'Demo emissions'}</p><p className="mt-1 text-lg font-semibold">{demoEmissions.toLocaleString('vi-VN',{maximumFractionDigits:1})} <span className="text-xs font-normal text-muted-foreground">tCO₂e</span></p></div>
              <div className="rounded-xl bg-muted/40 p-3"><PackageCheck className="mb-2 h-4 w-4 text-primary"/><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{vi ? 'Sản phẩm' : 'Products'}</p><p className="mt-1 text-lg font-semibold">{demoProducts.length}</p></div>
              <div className="rounded-xl bg-muted/40 p-3"><FileCheck2 className="mb-2 h-4 w-4 text-primary"/><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{vi ? 'Độ đầy đủ TB' : 'Avg completeness'}</p><p className="mt-1 text-lg font-semibold">{avgCompleteness}%</p></div>
            </div>

            <div className="p-5">
              <div className="grid gap-3 lg:grid-cols-2">
                {sections.map((section, index) => <div key={section} className="rounded-xl border border-border p-4"><div className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">{String(index + 1).padStart(2,'0')}</span><div><p className="text-sm font-medium">{section}</p><p className="mt-1 text-xs text-muted-foreground">{vi ? 'Cấu trúc theo profile thị trường; số liệu điền vào từ dataset DEMO và evidence graph.' : 'Structure follows the market profile; values are populated from the DEMO dataset and evidence graph.'}</p></div></div></div>)}
              </div>

              <div className="mt-5 rounded-xl border border-primary/20 bg-secondary/40 p-4">
                <p className="text-sm font-semibold">{vi ? 'Tuyên bố dữ liệu & tính pháp lý' : 'Data & legal status statement'}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{vi
                  ? 'Các tiêu chuẩn, văn bản và đường dẫn nguồn ở phần bên ngoài là registry tham chiếu thị trường. Mọi tên doanh nghiệp demo, sản lượng, phát thải, cường độ, evidence filename/hash và trạng thái readiness bên trong là dữ liệu minh họa của WeaveCarbon, không phải hồ sơ đã nộp, chứng nhận, hạn ngạch hoặc kết luận xác minh độc lập.'
                  : 'The external standards, legal instruments and source links form a market-reference registry. All demo company names, production, emissions, intensities, evidence filenames/hashes and readiness states inside this report are WeaveCarbon demonstration data, not an official filing, certification, allowance or independent verification conclusion.'}</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <SectionCard title={vi ? 'Sản phẩm demo theo thị trường' : 'Demo products by market'} description={vi ? 'Dữ liệu minh họa bên trong, không thay đổi quy tắc pháp lý bên ngoài.' : 'Internal demonstration data does not change the external legal rules.'} bodyClassName="p-0">
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3">{vi?'Sản phẩm':'Product'}</th><th className="px-5 py-3">{vi?'Ngành':'Industry'}</th><th className="px-5 py-3">{vi?'Thị trường':'Market'}</th><th className="px-5 py-3">{vi?'Cường độ':'Intensity'}</th><th className="px-5 py-3">{vi?'Mục tiêu báo cáo':'Report targets'}</th></tr></thead><tbody className="divide-y divide-border">{demoProducts.slice(0,8).map((p)=><tr key={p.id}><td className="px-5 py-4"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.productCode || p.id}{p.cnCode?` · CN ${p.cnCode}`:''}</p></td><td className="px-5 py-4 text-muted-foreground">{industryLabel(p.industry,vi)}</td><td className="px-5 py-4 text-muted-foreground">{p.destinationMarket || '—'}</td><td className="px-5 py-4 text-muted-foreground">{p.intensity || '—'}</td><td className="px-5 py-4"><div className="flex max-w-[300px] flex-wrap gap-1">{p.reportTargets.map((t)=><span key={t} className="rounded bg-secondary px-2 py-1 text-[10px] text-secondary-foreground">{t}</span>)}</div></td></tr>)}</tbody></table></div>
        </SectionCard>

        <SectionCard title={vi ? 'Evidence register demo cho profile đang chọn' : 'Demo evidence register for selected profile'} description={vi ? 'Filename/hash là synthetic metadata; chỉ dùng để minh họa data lineage.' : 'Filenames/hashes are synthetic metadata used only to demonstrate data lineage.'} bodyClassName="p-0">
          <div className="divide-y divide-border">{demoEvidence.length ? demoEvidence.slice(0,8).map((e)=><div key={e.id} className="px-5 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{e.fileName}</p><p className="mt-1 text-xs text-muted-foreground">{e.documentType} · {e.linkedActivity || '—'} · {e.period}</p></div><StatusPill label={e.evidenceLevel}/></div><p className="mt-2 text-[11px] text-muted-foreground">{e.status} · {e.integrityHash || 'No hash'}</p></div>) : <div className="p-8 text-center text-sm text-muted-foreground">{vi ? 'Profile này chưa có evidence demo được ánh xạ. Không tự tạo bằng chứng giả.' : 'No demo evidence is mapped to this profile. We do not fabricate evidence.'}</div>}</div>
        </SectionCard>
      </div>

      <div className="mt-6 rounded-xl border border-primary/20 bg-secondary/50 p-5">
        <div className="flex items-start gap-3"><Globe2 className="mt-0.5 h-5 w-5 text-primary"/><div><p className="font-medium text-foreground">{vi?'Nguyên tắc: nguồn ngoài chuẩn — dữ liệu trong demo':'Principle: authoritative outside — demo inside'}</p><p className="mt-1 text-sm text-muted-foreground">{vi?'Registry pháp lý/tiêu chuẩn phải được version theo ngày hiệu lực. Báo cáo chỉ được nâng từ “preparation/readiness” sang “official/verified” khi có đúng chủ thể nộp hồ sơ và bằng chứng xác minh độc lập tương ứng.':'The legal/standard registry is versioned by effective date. A report only moves from preparation/readiness to official/verified when the correct filing actor and corresponding independent verification evidence exist.'}</p></div></div>
      </div>
    </div>
  );
};

export default ReportRegistryClient;
