import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/dashboard/export/TextileFibreLabelPanel.tsx'), 'utf8'
);

describe('R08 textile fibre label workspace boundaries', () => {
  it('does not present the English preview as certified market artwork', () => {
    expect(source).toContain('Preview tiếng Anh chỉ hỗ trợ kiểm soát nội bộ');
    expect(source).toContain('textile_label_reviewer');
    expect(source).toContain('Duyệt cho artwork nội bộ');
  });

  it('exposes component, Annex-I, language, placement, evidence and source controls', () => {
    expect(source).toContain('Thành phần và xơ sợi Annex I');
    expect(source).toContain('Nguyên văn nhãn ngôn ngữ thị trường');
    expect(source).toContain('onlineBeforePurchase');
    expect(source).toContain('uploadTextileFibreLabelEvidence');
    expect(source).toContain('latest.result.englishPreview');
    expect(source).toContain('Nguồn EUR-Lex');
  });
});
