import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'components/dashboard/export/PcfStudyPanel.tsx'), 'utf8');

describe('R12 PCF study workspace boundaries', () => {
  it('keeps partial CFP separate from certification, comparison and assurance claims', () => {
    expect(source).toContain('không phải ISO certification');
    expect(source).toContain('comparative claim');
    expect(source).toContain('assurance độc lập');
    expect(source).toContain('pcf_practitioner_reviewer');
    expect(source).toContain('Duyệt báo cáo nội bộ');
  });
  it('exposes calculation provenance and ISO 14067 study controls', () => {
    expect(source).toContain('Calculation snapshot bất biến');
    expect(source).toContain('Boundary, process map và cutoff');
    expect(source).toContain('PCR, allocation và recycling');
    expect(source).toContain('Data quality, uncertainty và sensitivity');
    expect(source).toContain('AD × EF terms');
  });
});
