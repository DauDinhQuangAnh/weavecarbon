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
  });
});
