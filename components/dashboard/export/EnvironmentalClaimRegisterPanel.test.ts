import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/dashboard/export/EnvironmentalClaimRegisterPanel.tsx'), 'utf8'
);

describe('R18 environmental claim register boundaries', () => {
  it('does not present automated readiness as permission to publish', () => {
    expect(source).toContain('Không được xuất bản chỉ vì dossier hiện “ready”');
    expect(source).toContain('legal_claim_reviewer');
    expect(source).toContain('Phê duyệt đúng phạm vi');
    expect(source).toContain('Thu hồi');
  });

  it('exposes exact claim scope, checksum, findings and source version', () => {
    expect(source).toContain('Nguyên văn claim');
    expect(source).toContain('Calculation SHA-256');
    expect(source).toContain('latest.resultSha256');
    expect(source).toContain('finding.message');
    expect(source).toContain('source.version');
  });
});
