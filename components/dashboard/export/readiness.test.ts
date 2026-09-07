import { describe, expect, it } from 'vitest';
import { summarizeRequiredExportDocuments } from './readiness';
import type { ComplianceDocument } from './types';

const document = (status: ComplianceDocument['status'], validTo?: string): ComplianceDocument => ({
  id: `${status}-${validTo || 'none'}`,
  name: 'EU import dossier',
  type: 'export_compliance',
  required: true,
  status,
  validTo
});

describe('export document completeness', () => {
  it('counts only approved, non-expired required documents', () => {
    expect(summarizeRequiredExportDocuments([document('uploaded')])).toEqual({ total: 1, uploaded: 0, missing: 1 });
    expect(summarizeRequiredExportDocuments([document('approved', '2020-01-01')])).toEqual({ total: 1, uploaded: 0, missing: 1 });
    expect(summarizeRequiredExportDocuments([document('approved', '2099-01-01')])).toEqual({ total: 1, uploaded: 1, missing: 0 });
  });
});

