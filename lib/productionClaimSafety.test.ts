import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const productionClaimSurfaces = [
  'app/(dashboard)/data-gap/page.tsx',
  'app/(dashboard)/evidence/page.tsx',
  'components/audit/AuditPackClient.tsx',
  'components/dashboard/LogisticsClient.tsx',
  'components/dashboard/ProductQRCode.tsx',
  'components/dashboard/overview/OverviewPageClient.tsx',
  'components/passport/PassportClient.tsx',
  'app/passport/page.tsx',
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
      /AUDIT-READY|Sẵn sàng kiểm toán|CBAM-ready|Sẵn sàng Tuân thủ|Thuế CBAM ước tính|Rủi ro CBAM|Methodology:\s*100%|báo cáo chính thức|authoritative report|TUÂN THỦ ESG|Green Passport|statusCompliant|SGS|Bureau Veritas/i
    );
  });

  it('does not treat a newly uploaded data-gap file as verified or automatically low risk', () => {
    const source = read('app/(dashboard)/data-gap/page.tsx');
    expect(source).toContain("const verifiedCount = rows.filter((r) => r.currentStatus === 'verified').length");
    expect(source).not.toContain("{ currentStatus: 'uploaded', riskLevel: 'low' }");
  });

  it('renders public passport environmental copy only from resolved R18 dossiers', () => {
    const source = read('components/passport/PassportClient.tsx');
    const loadingSource = read('app/passport/page.tsx');
    expect(source).toContain('publicPayload.environmentalClaims');
    expect(source).toContain('claim.exactClaimText');
    expect(source).toContain('claim.specificationText');
    expect(source).toContain('Internal carbon calculations, transport emissions and self-declared labels are not displayed.');
    expect(source).not.toContain('{calculation.totalCO2.toFixed(2)}');
    expect(source).not.toContain('{formatExactValue(leg.co2Kg)} kg CO2e');
    expect(`${source}\n${loadingSource}`).not.toMatch(/(?:text|bg|border|from|via|to)-(?:green|emerald)-/);
  });

  it('keeps generated passport QR copy neutral until the public endpoint authorizes a claim', () => {
    const source = read('components/dashboard/ProductQRCode.tsx');
    const locale = JSON.parse(read('locales/vi/common.json')).products.qrCode;
    const publicCopy = JSON.stringify(locale);
    expect(source).toContain('product-passport-${code}.png');
    expect(`${source}\n${publicCopy}`).not.toMatch(/Hộ chiếu xanh|Green Passport|Sản phẩm đã xác minh|dấu chân carbon|tuân thủ xuất khẩu/i);
    expect(`${source}\n${publicCopy}`).not.toMatch(/(?:text|bg|border|from|via|to)-(?:green|emerald)-/);
  });
});
