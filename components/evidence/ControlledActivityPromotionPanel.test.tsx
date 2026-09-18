import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('controlled AI/OCR activity-promotion workspace contract', () => {
  const panel = readFileSync(
    resolve(process.cwd(), 'components/evidence/ControlledActivityPromotionPanel.tsx'),
    'utf8'
  );
  const api = readFileSync(
    resolve(process.cwd(), 'lib/evidenceActivityPromotionApi.ts'),
    'utf8'
  );
  const legacyHook = readFileSync(
    resolve(process.cwd(), 'hooks/useEvidenceUpload.ts'),
    'utf8'
  );

  it('separates immutable candidate creation from named authoritative promotion', () => {
    expect(panel).toContain('createCandidate');
    expect(panel).toContain('Tạo candidate bất biến');
    expect(panel).toContain('industrial_activity_promoter');
    expect(panel).toContain('Promote thành activity chính thức');
    expect(api).toContain('/activity-candidates');
    expect(api).toContain('/promote');
  });

  it('requires field-level semantic decisions, warnings and evidence matching', () => {
    expect(panel).toContain('fieldDecisions');
    expect(panel).toContain('overrideRationales');
    expect(panel).toContain('anomalyResolutions');
    expect(panel).toContain('evidenceMatches');
    expect(panel).toContain('evidenceMatchesComplete');
    expect(panel).toContain('bắt buộc accept/reject từng mục');
    expect(panel).toContain('LOW_CONFIDENCE_MAPPING');
    expect(panel).toContain('ZERO_QUANTITY');
  });

  it('keeps OCR quality claims within L1-L3 and removes the legacy verify bypass', () => {
    expect(panel).toContain('<option>L1</option><option>L2</option><option>L3</option>');
    expect(panel).not.toContain('<option>L4</option>');
    expect(panel).not.toContain('<option>L5</option>');
    expect(legacyHook).not.toContain('/verify');
    expect(legacyHook).not.toContain('chuyển sang dữ liệu sơ cấp');
  });
});
