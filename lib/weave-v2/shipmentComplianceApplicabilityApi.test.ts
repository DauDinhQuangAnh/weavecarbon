import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), raw: vi.fn()
}));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  evaluateComplianceApplicability, fetchComplianceApplicabilityEvaluations,
  lockComplianceApplicabilityEvidence, reviewComplianceApplicability,
  uploadComplianceApplicabilityEvidence, type ComplianceApplicabilityInput
} from './shipmentExportApi';

const input: ComplianceApplicabilityInput = {
  assessmentDate: '2026-09-14', productCategory: 'apparel', intendedUse: 'wearing',
  consumerGroup: 'adults', importerRole: 'EU importer', salesChannels: ['retail'],
  consumerProduct: true, placedOnEuMarket: true, textileFibrePercent: 100,
  reachContext: {
    directAndProlongedSkinOrOralContact: true,
    washableInWaterDuringNormalLifecycle: true,
    secondHand: false,
    exclusivelyRecycledWithoutNpe: false,
    leatherPartsContactSkin: false
  },
  packagingContext: {
    present: true, types: ['sales'], materials: ['paper'], reusable: false,
    supplierIdentified: true, customerIdentified: true, directDistanceSaleToEuEndUser: false,
    producerRoleAssessed: false
  },
  materialFacts: [], notes: 'Internal triage only.'
};

describe('shipment R20 compliance applicability API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped evaluation and checksum-review endpoints', async () => {
    apiMock.get.mockResolvedValue([]);
    apiMock.post.mockResolvedValue({ id: 'evaluation-1' });

    await fetchComplianceApplicabilityEvaluations('shipment/1');
    await evaluateComplianceApplicability('shipment/1', input);
    await reviewComplianceApplicability('shipment/1', 'evaluation/1', {
      reviewerRole: 'compliance_specialist', decision: 'confirmed_for_internal_planning',
      notes: 'Checked source versions.', evidenceDocumentIds: ['evidence-1']
    });

    const root = '/export/shipments/shipment%2F1/compliance/applicability-evaluations';
    expect(apiMock.get).toHaveBeenCalledWith(root);
    expect(apiMock.post).toHaveBeenCalledWith(root, input);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/evaluation%2F1/reviews`, expect.objectContaining({
      reviewerRole: 'compliance_specialist', decision: 'confirmed_for_internal_planning',
      evidenceDocumentIds: ['evidence-1']
    }));
  });

  it('uploads and locks a compliance-assessment evidence file', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    apiMock.post.mockResolvedValue({ id: 'evidence-1', status: 'locked' });

    await uploadComplianceApplicabilityEvidence('shipment-1', new File(['memo'], 'scope-memo.pdf'));
    await lockComplianceApplicabilityEvidence('evidence/1');

    const request = apiMock.raw.mock.calls[0];
    expect(request[0]).toBe('/evidence/upload');
    expect(request[1].body.get('kind')).toBe('compliance_assessment');
    expect(request[1].body.get('shipmentId')).toBe('shipment-1');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
