import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'components/dashboard/export/ReachSvhcDossierPanel.tsx'), 'utf8');

describe('R11 REACH/SVHC workspace boundaries', () => {
  it('never presents the dossier as a certificate or ECHA submission', () => {
    expect(source).toContain('không phải “REACH certificate”');
    expect(source).toContain('ECHA/SCIP notification');
    expect(source).toContain('chemical_compliance_reviewer');
    expect(source).toContain('Duyệt phát hành nội bộ');
  });
  it('exposes article-level, substance, threshold, restriction, evidence and response controls', () => {
    expect(source).toContain('Article/component và homogeneous material');
    expect(source).toContain('Candidate List · Article 7/33');
    expect(source).toContain('Annex XVII restriction assessment');
    expect(source).toContain('consumer 45-day');
    expect(source).toContain('không chứa dữ liệu cá nhân');
    expect(source).toContain('Candidate List ECHA');
  });
});
