import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const productionClaimSurfaces = [
  'app/(dashboard)/data-gap/page.tsx',
  'app/(dashboard)/evidence/page.tsx',
  'components/audit/AuditPackClient.tsx',
  'components/dashboard/LogisticsClient.tsx',
  'components/dashboard/overview/OverviewPageClient.tsx',
  'components/dashboard/reports/ReportClient.tsx',
  'components/dashboard/reports/ReportPreviewModal.tsx',
  'components/dashboard/CompliancePanel.tsx',
  'components/ui/RedFlagBanner.tsx',
  'config/penalties.ts',
  'lib/weave-v2/productReportAdapter.ts',
  'lib/weave-v2/reportTemplate.ts',
  'lib/reports/standardReportPdf.ts',
  'lib/reports/standardReportXlsx.ts'
];

describe('production environmental-claim guardrails', () => {
  it.each(productionClaimSurfaces)('%s avoids unsupported readiness and liability claims', (path) => {
    const source = read(path);
    expect(source).not.toMatch(
      /AUDIT-READY|Sẵn sàng kiểm toán|CBAM-ready|Sẵn sàng Tuân thủ|Thuế CBAM ước tính|Rủi ro CBAM|Methodology:\s*100%|báo cáo chính thức|authoritative report|TUÂN THỦ ESG|SGS|Bureau Veritas/i
    );
  });

  it('does not treat a newly uploaded data-gap file as verified or automatically low risk', () => {
    const source = read('app/(dashboard)/data-gap/page.tsx');
    expect(source).toContain("const verifiedCount = rows.filter((r) => r.currentStatus === 'verified').length");
    expect(source).not.toContain("{ currentStatus: 'uploaded', riskLevel: 'low' }");
  });
});
