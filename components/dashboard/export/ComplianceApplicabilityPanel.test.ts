import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/dashboard/export/ComplianceApplicabilityPanel.tsx'), 'utf8'
);

describe('R20 compliance applicability panel claims', () => {
  it('keeps limited coverage and legal-status boundaries visible', () => {
    expect(source).toContain('Coverage giới hạn');
    expect(source).toContain('Không phải tư vấn pháp lý, giấy phép, chứng nhận');
    expect(source).toContain('Xác nhận nội bộ');
    expect(source).toContain('confirmed_for_internal_planning');
  });

  it('shows source versions, reasons, evidence requirements and result checksum', () => {
    expect(source).toContain('source.version');
    expect(source).toContain('match.reason');
    expect(source).toContain('match.requiredEvidenceTypes');
    expect(source).toContain('latest.resultSha256');
    expect(source).toContain('latest.result.datasets || []');
    expect(source).toContain('latest.result.classifications || []');
    expect(source).toContain('dataset không phải quyết định phân loại hải quan hoặc BTI');
    expect(source).toContain('Mở snapshot TARIC chính thức');
    expect(source).toContain('latest.result.restrictionScreenings || []');
    expect(source).toContain('REACH Annex XVII · {screening.entryNumber}');
    expect(source).toContain('Ngưỡng chỉ để sàng lọc; phải hoàn tất hồ sơ R11');
    expect(source).toContain('latest.result.speciesScreenings || []');
    expect(source).toContain('CITES Appendix / EU Annex');
    expect(source).toContain('reference nhập tay không chứng minh giấy phép hợp lệ');
  });

  it('captures species and permit-routing facts without asserting wildlife document validity', () => {
    expect(source).toContain('speciesScientificName');
    expect(source).toContain('specimenDescription');
    expect(source).toContain('wildlifeSourceCode');
    expect(source).toContain('citesDocumentReference');
    expect(source).toContain('euImportPermitReference');
    expect(source).toContain('wildlifeDocumentsVerified');
    expect(source).toContain('Bắt buộc kiểm tra suspension theo quốc gia/nguồn/mẫu');
  });

  it('captures bounded Annex XVII scope facts without claiming chemical conformity', () => {
    expect(source).toContain('Dữ kiện phạm vi REACH Annex XVII');
    expect(source).toContain('directAndProlongedSkinOrOralContact');
    expect(source).toContain('washableInWaterDuringNormalLifecycle');
    expect(source).toContain('exclusivelyRecycledWithoutNpe');
    expect(source).toContain('leatherPartsContactSkin');
    expect(source).toContain('không phải kết luận hóa chất đạt/không đạt');
  });

  it('captures PPWR packaging context without presenting an EPR compliance conclusion', () => {
    expect(source).toContain('Dữ kiện bao bì PPWR');
    expect(source).toContain('directDistanceSaleToEuEndUser');
    expect(source).toContain('producerRoleAssessed');
    expect(source).toContain('không xác nhận đăng ký, phí hoặc báo cáo theo quốc gia');
  });
});
