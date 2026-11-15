/* eslint-disable @typescript-eslint/no-explicit-any -- ported 1:1 from the Lovable demo data layer (schemaless snapshot rows); typed at the module boundary. */
import type { IndustrialDatasetState } from '../dataset';
import type { IndustrialReportingState } from '../reporting';
import type { LegalMarketProfile, ReportingIndustry } from '../legalMarketRegistry';

export type ReportCheckLevel = 'pass' | 'warning' | 'blocker' | 'info';

export interface ReportCheck {
  id: string;
  level: ReportCheckLevel;
  label: string;
  detail: string;
}

export interface ReportSection {
  id: string;
  title: string;
  body: string[];
  facts?: Array<{ label: string; value: string }>;
}

export interface GeneratedIndustryReport {
  id: string;
  title: string;
  subtitle: string;
  industry: ReportingIndustry;
  period: string;
  profileCode: string;
  profileTitle: string;
  market: string;
  generatedAt: string;
  demo: boolean;
  status: 'draft' | 'needs-review' | 'verification-ready';
  metrics: {
    facilities: number;
    products: number;
    activities: number;
    evidence: number;
    emissionsTco2e: number;
    dataQualityPct: number;
    evidenceCoveragePct: number;
    primaryCoveragePct: number;
    openFindings: number;
  };
  checks: ReportCheck[];
  sections: ReportSection[];
  references: Array<{ label: string; url: string; status: string }>;
}

interface BuildReportArgs {
  dataset: IndustrialDatasetState;
  reporting: IndustrialReportingState;
  profile: LegalMarketProfile;
  industry: ReportingIndustry;
  period: string;
  vi: boolean;
  demo?: boolean;
}

const n = (value: number, digits = 1) => value.toLocaleString('en-US', { maximumFractionDigits: digits });

const industryLabel = (industry: ReportingIndustry, vi: boolean) => vi ? ({
  Agriculture: 'Nông nghiệp & nông sản',
  Steel: 'Thép',
  Cement: 'Xi măng',
  'Construction Materials': 'Vật liệu xây dựng',
  Aluminium: 'Nhôm',
  Chemicals: 'Phân bón & hóa chất',
  'Mining & Minerals': 'Khai khoáng & khoáng sản',
}[industry] || industry) : industry;

function cityTokens(name: string) {
  const stop = new Set(['Plant', 'Site', 'Factory', 'Materials', 'Steel', 'Cement', 'Agriculture', 'Aluminium', 'Chemicals', 'Minerals']);
  return name.split(/\s+/).filter((part) => part.length > 2 && !stop.has(part));
}

function relevantGaps(dataset: IndustrialDatasetState, facilityNames: string[]) {
  if (!facilityNames.length) return [];
  const tokens = facilityNames.flatMap(cityTokens);
  return dataset.dataGaps.filter((gap: any) => tokens.some((token) => String(gap.entity || '').includes(token)));
}

function monthlyIndustryEmissions(reporting: IndustrialReportingState, industry: ReportingIndustry, period: string, fallback: number) {
  const rows = reporting.cadence.filter((row) => row.industry === industry && (period === 'All' || row.periodLabel === period));
  if (!rows.length) return fallback;
  return rows.reduce((sum, row) => sum + Number(row.emissionsTco2e || 0), 0);
}

function buildIndustryNarrative(industry: ReportingIndustry, vi: boolean) {
  const text: Record<ReportingIndustry, [string, string]> = {
    Agriculture: [
      'Ưu tiên PCF theo sản phẩm, dữ liệu vùng trồng (phân bón, tưới, sấy), truy xuất EUDR, logistics và dữ liệu hợp tác xã. Nông sản không thuộc CBAM.',
      'Prioritise product PCF, farm inputs (fertiliser, irrigation, drying), EUDR traceability, logistics and cooperative data. Agricultural goods are not CBAM sectors.',
    ],
    Steel: [
      'Ưu tiên ranh giới cơ sở, nhiên liệu/nguyên liệu luyện kim, production route, sản lượng và CN code. Khi hàng hóa thuộc phạm vi EU CBAM, cần tách dữ liệu installation và embedded emissions theo profile áp dụng.',
      'Prioritise facility boundary, metallurgical fuel/material inputs, production route, output and CN code. For EU CBAM-covered goods, retain installation-level data and embedded-emissions lineage.',
    ],
    Cement: [
      'Ưu tiên clinker/cement production, calcination, kiln fuel mix, điện và clinker ratio. CBAM chỉ áp dụng khi hàng hóa/CN code thuộc phạm vi.',
      'Prioritise clinker/cement production, calcination, kiln fuel mix, electricity and clinker ratio. CBAM applies only when the goods/CN code are in scope.',
    ],
    'Construction Materials': [
      'Ưu tiên dữ liệu sản phẩm, nguyên liệu, điện/nhiên liệu, logistics và buyer PCF/ISO 14067 khi phù hợp. Không suy diễn CBAM cho toàn ngành vật liệu xây dựng.',
      'Prioritise product, material, energy/fuel, logistics and buyer PCF/ISO 14067 data where relevant. Do not infer CBAM applicability for the whole construction-materials sector.',
    ],
    Aluminium: [
      'Ưu tiên điện, nhiên liệu gia nhiệt, sản lượng, alloying inputs, installation và CN code. Với EU CBAM, chỉ tạo preparation pack cho hàng hóa thuộc scope.',
      'Prioritise electricity, reheating fuel, output, alloying inputs, installation and CN code. For EU CBAM, create a preparation pack only for covered goods.',
    ],
    Chemicals: [
      'Tách rõ chemicals nói chung và fertilisers thuộc CBAM. Report cần giữ product identity/CN code trước khi kích hoạt CBAM adapter.',
      'Distinguish general chemicals from CBAM-covered fertilisers. The report must retain product identity/CN code before activating a CBAM adapter.',
    ],
    'Mining & Minerals': [
      'Ưu tiên diesel khai trường, điện nghiền/sàng, sản lượng, ranh giới cơ sở và bằng chứng vận hành. Đầu ra chính là inventory/ISO/GHG hoặc buyer-specific khi phù hợp.',
      'Prioritise quarry diesel, crushing/screening electricity, output, facility boundary and operational evidence. Primary outputs are inventory/ISO/GHG or buyer-specific packages where relevant.',
    ],
  };
  return vi ? text[industry][0] : text[industry][1];
}

export function buildMonthlyIndustryReport({ dataset, reporting, profile, industry, period, vi, demo = true }: BuildReportArgs): GeneratedIndustryReport {
  const facilities = dataset.facilities.filter((f: any) => f.industry === industry);
  const facilityNames = facilities.map((f: any) => String(f.name));
  const activities = dataset.activityData.filter((row: any) => facilityNames.includes(row.facility) && (period === 'All' || row.period === period));
  const processes = dataset.processes.filter((row: any) => facilityNames.includes(row.facility));
  const products = reporting.products.filter((p) => p.industry === industry);
  const productIds = new Set(products.map((p) => p.id));
  const facilityIds = new Set(facilities.map((f: any) => f.id));
  const evidence = reporting.evidence.filter((e) => productIds.has(e.productId || '') || facilityIds.has(e.facilityId || ''));
  const gaps = relevantGaps(dataset, facilityNames);
  const highGaps = gaps.filter((gap: any) => String(gap.impact).toLowerCase() === 'high');
  const facilityEmissions = facilities.reduce((sum: number, f: any) => sum + Number(f.tonnes || 0), 0);
  const emissions = monthlyIndustryEmissions(reporting, industry, period, facilityEmissions);
  const primary = activities.filter((a: any) => a.quality === 'Primary' || a.quality === 'Evidence-backed').length;
  const primaryCoveragePct = activities.length ? Math.round(primary / activities.length * 100) : 0;
  const evidenceCoveragePct = activities.length ? Math.min(100, Math.round(evidence.length / activities.length * 100)) : (evidence.length ? 100 : 0);
  const dataQualityPct = facilities.length ? Math.round(facilities.reduce((sum: number, f: any) => sum + Number(f.completeness || 0), 0) / facilities.length) : 0;
  const factorTagged = activities.filter((a: any) => Boolean(a.factorKey)).length;
  const cbamProducts = products.filter((p) => p.reportTargets.includes('EU_CBAM_2026'));
  const missingCn = profile.reportProfileCode === 'EU_CBAM_2026' ? cbamProducts.filter((p) => !p.cnCode) : [];
  const applicable = profile.applicableIndustries.includes(industry);

  const checks: ReportCheck[] = [
    {
      id: 'data',
      level: activities.length ? 'pass' : 'blocker',
      label: vi ? 'Dữ liệu hoạt động theo kỳ' : 'Period activity data',
      detail: activities.length
        ? (vi ? `${activities.length} bản ghi activity data được thu thập cho ${period}.` : `${activities.length} activity records collected for ${period}.`)
        : (vi ? 'Không tìm thấy activity data cho kỳ đã chọn.' : 'No activity data found for the selected period.'),
    },
    {
      id: 'evidence',
      level: evidenceCoveragePct >= 80 ? 'pass' : evidenceCoveragePct >= 50 ? 'warning' : 'blocker',
      label: vi ? 'Liên kết bằng chứng' : 'Evidence linkage',
      detail: vi ? `Ước tính coverage ${evidenceCoveragePct}% với ${evidence.length} bản ghi bằng chứng.` : `Estimated ${evidenceCoveragePct}% coverage with ${evidence.length} evidence records.`,
    },
    {
      id: 'primary',
      level: primaryCoveragePct >= 70 ? 'pass' : 'warning',
      label: vi ? 'Dữ liệu primary / evidence-backed' : 'Primary / evidence-backed data',
      detail: vi ? `${primaryCoveragePct}% activity records ở mức Primary hoặc Evidence-backed.` : `${primaryCoveragePct}% of activity records are Primary or Evidence-backed.`,
    },
    {
      id: 'factor',
      level: factorTagged ? 'pass' : 'warning',
      label: vi ? 'Factor snapshot & phương pháp' : 'Factor snapshot & method',
      detail: vi ? `${factorTagged}/${activities.length} activity records đang có factor key trực tiếp; các phép tính còn lại phải truy vết qua calculation snapshot.` : `${factorTagged}/${activities.length} activity records carry a direct factor key; remaining calculations must be traceable through the calculation snapshot.`,
    },
    {
      id: 'scope',
      level: applicable ? 'pass' : 'blocker',
      label: vi ? 'Áp dụng theo ngành / thị trường' : 'Industry / market applicability',
      detail: applicable ? (vi ? 'Industry Pack phù hợp với profile đã chọn.' : 'Selected profile is compatible with this Industry Pack.') : (vi ? 'Profile đã chọn không áp dụng cho ngành này.' : 'Selected profile does not apply to this industry.'),
    },
    ...(profile.reportProfileCode === 'EU_CBAM_2026' ? [{
      id: 'cbam-cn',
      level: (cbamProducts.length && !missingCn.length ? 'pass' : 'blocker') as ReportCheckLevel,
      label: vi ? 'CBAM CN code / product scope' : 'CBAM CN code / product scope',
      detail: cbamProducts.length
        ? (missingCn.length ? (vi ? `${missingCn.length} sản phẩm CBAM thiếu CN code.` : `${missingCn.length} CBAM-mapped products are missing CN codes.`) : (vi ? `${cbamProducts.length} sản phẩm có target CBAM và CN code.` : `${cbamProducts.length} products have CBAM targets and CN codes.`))
        : (vi ? 'Không có sản phẩm trong ngành được ánh xạ CBAM; không được phát hành hồ sơ CBAM.' : 'No product in this industry is mapped to CBAM; a CBAM pack must not be issued.'),
    }] : []),
    {
      id: 'findings',
      level: highGaps.length ? 'warning' : 'pass',
      label: vi ? 'Khoảng trống dữ liệu quan trọng' : 'Material data gaps',
      detail: vi ? `${gaps.length} finding liên quan; ${highGaps.length} mức High.` : `${gaps.length} relevant findings; ${highGaps.length} rated High.`,
    },
    {
      id: 'verification',
      level: 'info',
      label: vi ? 'Trạng thái xác minh' : 'Verification status',
      detail: vi ? 'WeaveCarbon chỉ tạo verification-ready package; không tự gắn trạng thái independently verified.' : 'WeaveCarbon prepares a verification-ready package and never self-assigns independently verified status.',
    },
  ];

  const blockers = checks.filter((c) => c.level === 'blocker').length;
  const warnings = checks.filter((c) => c.level === 'warning').length;
  const status: GeneratedIndustryReport['status'] = blockers ? 'draft' : warnings ? 'needs-review' : 'verification-ready';
  const profileTitle = vi ? profile.titleVi : profile.titleEn;
  const ind = industryLabel(industry, vi);
  const topProcess = [...processes].sort((a: any, b: any) => Number(b.tonnes || 0) - Number(a.tonnes || 0))[0];
  const topProduct = products[0];

  const sections: ReportSection[] = [
    {
      id: 'executive',
      title: vi ? '1. Tóm tắt điều hành' : '1. Executive summary',
      body: [
        vi
          ? `Báo cáo ${profileTitle} này được dựng tự động từ lớp dữ liệu carbon được quản trị của WeaveCarbon cho ngành ${ind}, kỳ ${period}. Kết quả bên trong là ${demo ? 'DỮ LIỆU DEMO' : 'dữ liệu doanh nghiệp'}; cấu trúc hồ sơ và căn cứ thị trường lấy từ reporting registry đã version.`
          : `This ${profileTitle} report is assembled from WeaveCarbon's governed carbon-data layer for ${ind}, period ${period}. Internal values are ${demo ? 'DEMO DATA' : 'company data'}; report structure and market basis come from the versioned reporting registry.`,
        vi
          ? `Tổng phát thải được dùng trong view này là ${n(emissions)} tCO₂e; data completeness trung bình ${dataQualityPct}%; evidence coverage ước tính ${evidenceCoveragePct}%.`
          : `Emissions represented in this view are ${n(emissions)} tCO₂e; average data completeness is ${dataQualityPct}%; estimated evidence coverage is ${evidenceCoveragePct}%.`,
      ],
      facts: [
        { label: vi ? 'Cơ sở' : 'Facilities', value: String(facilities.length) },
        { label: vi ? 'Sản phẩm' : 'Products', value: String(products.length) },
        { label: 'Activity records', value: String(activities.length) },
        { label: vi ? 'Bằng chứng' : 'Evidence', value: String(evidence.length) },
      ],
    },
    {
      id: 'scope',
      title: vi ? '2. Đối tượng, mục tiêu và phạm vi báo cáo' : '2. Reporting object, goal and scope',
      body: [
        vi ? `Đối tượng: Industry Pack ${ind}. Profile: ${profileTitle}. Thị trường/phân khúc: ${profile.market}.` : `Object: ${ind} Industry Pack. Profile: ${profileTitle}. Market/segment: ${profile.market}.`,
        vi ? profile.scopeVi : profile.scopeEn,
        vi ? (profile.industryNoteVi || buildIndustryNarrative(industry, vi)) : (profile.industryNoteEn || buildIndustryNarrative(industry, vi)),
      ],
    },
    {
      id: 'basis',
      title: vi ? '3. Căn cứ pháp lý / tiêu chuẩn / hợp đồng' : '3. Legal / standard / contractual basis',
      body: [vi ? profile.legalStatusVi : profile.legalStatusEn, vi ? profile.officialSubmissionVi : profile.officialSubmissionEn],
      facts: profile.references.map((r) => ({ label: r.label, value: vi ? r.statusVi : r.statusEn })),
    },
    {
      id: 'inventory',
      title: vi ? '4. Dữ liệu đầu vào theo tháng' : '4. Monthly input inventory',
      body: [
        vi ? `Engine thu thập ${activities.length} activity records, ${products.length} product records, ${processes.length} process records và ${evidence.length} evidence records liên quan.` : `The engine collected ${activities.length} activity records, ${products.length} product records, ${processes.length} process records and ${evidence.length} related evidence records.`,
        vi ? `Dữ liệu được giữ nguyên giá trị gốc; AI chỉ hỗ trợ phân loại, đối chiếu và viết narrative, không sửa activity data hay kết quả deterministic calculation.` : `Source values remain unchanged; AI assists classification, cross-checking and narrative generation but does not alter activity data or deterministic calculation results.`,
      ],
      facts: activities.slice(0, 6).map((a: any) => ({ label: `${a.activity} · ${a.facility}`, value: `${n(Number(a.value || 0), 2)} ${a.unit} · ${a.quality}` })),
    },
    {
      id: 'method',
      title: vi ? '5. Phương pháp định lượng & calculation lineage' : '5. Quantification method & calculation lineage',
      body: [
        vi ? 'Nguyên tắc chung: Activity Data × Emission Factor × conversion/allocation rule. GHG được quy đổi sang CO₂e theo accounting context và factor/GWP snapshot đã khóa cho calculation version.' : 'General principle: Activity Data × Emission Factor × conversion/allocation rule. GHGs are converted to CO₂e under the accounting context and locked factor/GWP snapshot for the calculation version.',
        vi ? 'Electricity factor phải theo nơi tiêu thụ điện; target market không được dùng để chọn grid factor. Product PCF và corporate Scope 2 được giữ ở accounting context riêng.' : 'Electricity factors follow the consumption geography; target market must not select the grid factor. Product PCF and corporate Scope 2 remain separate accounting contexts.',
      ],
    },
    {
      id: 'results',
      title: vi ? '6. Kết quả carbon & hotspot' : '6. Carbon results & hotspot',
      body: [
        vi ? `Kết quả kỳ ${period}: ${n(emissions)} tCO₂e cho phạm vi dữ liệu ngành được chọn.` : `Result for ${period}: ${n(emissions)} tCO₂e for the selected industry data scope.`,
        topProcess ? (vi ? `Hotspot quy trình lớn nhất trong demo: ${topProcess.name} (${n(Number(topProcess.tonnes || 0))} tCO₂e).` : `Largest process hotspot in the demo: ${topProcess.name} (${n(Number(topProcess.tonnes || 0))} tCO₂e).`) : (vi ? 'Chưa có process hotspot cho phạm vi này.' : 'No process hotspot is available for this scope.'),
        topProduct ? (vi ? `Sản phẩm tham chiếu: ${topProduct.name}${topProduct.intensity ? ` · intensity ${topProduct.intensity}` : ''}.` : `Reference product: ${topProduct.name}${topProduct.intensity ? ` · intensity ${topProduct.intensity}` : ''}.`) : '',
      ].filter(Boolean),
    },
    {
      id: 'quality',
      title: vi ? '7. Chất lượng dữ liệu, QA/QC & Evidence Graph' : '7. Data quality, QA/QC & Evidence Graph',
      body: [
        vi ? `Primary/Evidence-backed coverage: ${primaryCoveragePct}%. Evidence coverage ước tính: ${evidenceCoveragePct}%.` : `Primary/Evidence-backed coverage: ${primaryCoveragePct}%. Estimated evidence coverage: ${evidenceCoveragePct}%.`,
        vi ? `${gaps.length} finding liên quan được giữ trong audit trail; ${highGaps.length} finding mức High cần được đóng trước khi nâng trạng thái.` : `${gaps.length} relevant findings remain in the audit trail; ${highGaps.length} High findings should be closed before status is upgraded.`,
      ],
    },
    {
      id: 'industry',
      title: vi ? '8. Kiểm tra chuyên biệt theo ngành & thị trường' : '8. Industry & market-specific review',
      body: [buildIndustryNarrative(industry, vi), vi ? profile.verificationVi : profile.verificationEn],
      facts: (vi ? profile.reportSectionsVi : profile.reportSectionsEn).map((item, index) => ({ label: `${index + 1}`, value: item })),
    },
    {
      id: 'findings',
      title: vi ? '9. Findings & hành động trước khi phát hành' : '9. Findings & pre-issue actions',
      body: blockers || warnings
        ? checks.filter((c) => c.level === 'blocker' || c.level === 'warning').map((c) => `${c.label}: ${c.detail}`)
        : [vi ? 'Không có blocker trong bộ kiểm tra tự động hiện tại. Vẫn cần human review trước khi phát hành.' : 'No blocker was found by the current automated checks. Human review is still required before issue.'],
    },
    {
      id: 'verification',
      title: vi ? '10. Trạng thái review, verification & giới hạn' : '10. Review, verification & limitations',
      body: [
        vi ? `Trạng thái hệ thống: ${status === 'verification-ready' ? 'Verification-ready' : status === 'needs-review' ? 'Needs review' : 'Draft / blocked'}.` : `System status: ${status}.`,
        vi ? 'Report không tự trở thành filing pháp lý, chứng nhận ISO hoặc tuyên bố independently verified. Các trạng thái đó chỉ được ghi nhận khi có quy trình/đơn vị có thẩm quyền tương ứng.' : 'The report does not become a legal filing, ISO certification or independently verified statement automatically. Those statuses require the applicable authorised process/body.',
      ],
    },
    {
      id: 'conclusion',
      title: vi ? '11. Kết luận' : '11. Conclusion',
      body: [
        vi ? `WeaveCarbon đã tổng hợp dữ liệu tháng ${period}, đối chiếu tính đầy đủ, bằng chứng, scope và market profile cho ngành ${ind}. Report có thể tiếp tục sang human review khi các blocker đã được xử lý.` : `WeaveCarbon assembled ${period} data, cross-checked completeness, evidence, scope and market profile for ${ind}. The report can proceed to human review once blockers are resolved.`,
      ],
    },
    {
      id: 'annex',
      title: vi ? '12. Phụ lục truy vết' : '12. Traceability annex',
      body: [
        vi ? 'Phụ lục đầy đủ nên chứa Activity Data, Factor Registry, Evidence Register, Calculation Lineage, Legal References và Version/Change Log.' : 'The complete annex should contain Activity Data, Factor Registry, Evidence Register, Calculation Lineage, Legal References and Version/Change Log.',
      ],
      facts: [
        { label: 'Engine', value: `WeaveCarbon ${dataset.organization.engineVersion}` },
        { label: vi ? 'Nguồn dữ liệu' : 'Data source', value: dataset.dataSource || 'unknown' },
        { label: vi ? 'Profile' : 'Profile', value: profile.code },
        { label: vi ? 'Kỳ' : 'Period', value: period },
      ],
    },
  ];

  return {
    id: `WC-${industry.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}-${profile.code}-${period.replace(/\s+/g, '-').toUpperCase()}`,
    title: profileTitle,
    subtitle: vi ? `${ind} · ${period} · AI-assisted report` : `${ind} · ${period} · AI-assisted report`,
    industry,
    period,
    profileCode: profile.code,
    profileTitle,
    market: profile.market,
    generatedAt: new Date().toISOString(),
    demo,
    status,
    metrics: {
      facilities: facilities.length,
      products: products.length,
      activities: activities.length,
      evidence: evidence.length,
      emissionsTco2e: emissions,
      dataQualityPct,
      evidenceCoveragePct,
      primaryCoveragePct,
      openFindings: gaps.length,
    },
    checks,
    sections,
    references: profile.references.map((r) => ({ label: r.label, url: r.url, status: vi ? r.statusVi : r.statusEn })),
  };
}

export function defaultProfileForIndustry(industry: ReportingIndustry, profiles: LegalMarketProfile[]) {
  const priority: Record<ReportingIndustry, string[]> = {
    Agriculture: ['ISO_14067', 'BUYER_PCF', 'GHG_PRODUCT'],
    Steel: ['EU_CBAM_2026', 'VN_GHG_INVENTORY', 'ISO_14064_1'],
    Cement: ['EU_CBAM_2026', 'VN_GHG_INVENTORY', 'ISO_14064_1'],
    'Construction Materials': ['ISO_14067', 'BUYER_PCF', 'GHG_PRODUCT'],
    Aluminium: ['EU_CBAM_2026', 'ISO_14067', 'VN_GHG_INVENTORY'],
    Chemicals: ['EU_CBAM_2026', 'ISO_14067', 'VN_GHG_INVENTORY'],
    'Mining & Minerals': ['VN_GHG_INVENTORY', 'ISO_14064_1', 'GHG_CORPORATE'],
  };
  for (const code of priority[industry]) {
    const found = profiles.find((p) => p.reportProfileCode === code && p.applicableIndustries.includes(industry));
    if (found) return found;
  }
  return profiles.find((p) => p.applicableIndustries.includes(industry)) || profiles[0];
}
