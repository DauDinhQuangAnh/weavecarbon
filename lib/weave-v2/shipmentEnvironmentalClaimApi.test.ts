import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), raw: vi.fn()
}));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  createEnvironmentalClaimDossier, fetchEnvironmentalClaimDossiers,
  lockEnvironmentalClaimEvidence, reviewEnvironmentalClaimDossier,
  uploadEnvironmentalClaimEvidence, type EnvironmentalClaimInput
} from './shipmentExportApi';

const input: EnvironmentalClaimInput = {
  claimReference: 'CLAIM-1', exactClaimText: '20% less cradle-to-gate CO2e than baseline X.',
  publicCommunication: true, channel: 'website', marketCodes: ['DE'], languageCode: 'de-DE',
  communicationStart: '2026-09-27', communicationEnd: null, subjectType: 'sku',
  subjectReference: 'SKU-1', scopeStatement: 'SKU only', claimKind: 'specific_environmental',
  specificationText: 'Compared with baseline X.', claimScopeMode: 'specific_aspect', actualCoverage: 'aspect_only',
  recognizedExcellentPerformance: false,
  methodology: { standard: 'method', version: '1', pcr: '', calculationSha256: 'a'.repeat(64), datasetReferences: ['d1'], factorReferences: ['f1'] },
  comparison: { baseline: '', comparator: '', sameMethodAndScope: false },
  futureCommitment: { implementationPlanUrl: '', milestones: [], independentMonitoring: false },
  labelScheme: { schemeType: 'other', schemeName: '', publicCriteriaUrl: '' },
  limitations: [], exclusions: [], uncertaintyStatement: '±15%', qualifiers: [],
  updateTriggers: ['method change'], withdrawalTriggers: ['evidence expiry'], assuranceReference: '',
  evidenceDocumentIds: ['11111111-1111-4111-8111-111111111111'], notes: ''
};

describe('shipment R18 environmental claim API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped dossier and append-only review endpoints', async () => {
    await fetchEnvironmentalClaimDossiers('shipment/1');
    await createEnvironmentalClaimDossier('shipment/1', input);
    await reviewEnvironmentalClaimDossier('shipment/1', 'dossier/1', {
      reviewerRole: 'legal_claim_reviewer', decision: 'approved_for_publication', notes: 'Approved exact scope.'
    });
    const root = '/export/shipments/shipment%2F1/environmental-claims';
    expect(apiMock.get).toHaveBeenCalledWith(root);
    expect(apiMock.post).toHaveBeenCalledWith(root, input);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/dossier%2F1/reviews`, expect.objectContaining({
      reviewerRole: 'legal_claim_reviewer', decision: 'approved_for_publication'
    }));
  });

  it('uploads and locks substantiation evidence', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    await uploadEnvironmentalClaimEvidence('shipment-1', new File(['memo'], 'claim-method.pdf'));
    await lockEnvironmentalClaimEvidence('evidence/1');
    expect(apiMock.raw.mock.calls[0][1].body.get('kind')).toBe('environmental_claim_substantiation');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
