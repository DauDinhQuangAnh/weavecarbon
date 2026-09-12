import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), raw: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  emptyOriginProfile, fetchOriginReconciliation, lockOriginEvidence,
  saveOriginProfile, uploadOriginEvidence
} from './shipmentExportApi';

describe('shipment EVFTA origin-support handoff API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses controlled shipment-scoped R07 endpoints', async () => {
    const profile = emptyOriginProfile();
    apiMock.put.mockResolvedValue(profile);
    apiMock.get.mockResolvedValue({ status: 'blocked' });
    await saveOriginProfile('shipment/1', profile);
    await fetchOriginReconciliation('shipment/1');

    expect(profile).toMatchObject({
      handoffPurpose: 'origin_specialist_review', claimType: 'certificate_application',
      rulesetVersion: 'R07-EVFTA-ORIGIN-2026.09.1'
    });
    expect(apiMock.put).toHaveBeenCalledWith('/export/shipments/shipment%2F1/origin/profile', expect.objectContaining({
      claimType: 'certificate_application', lineAssessments: []
    }));
    expect(apiMock.put.mock.calls[0][1]).not.toHaveProperty('schemaId');
    expect(apiMock.get).toHaveBeenCalledWith('/export/shipments/shipment%2F1/origin/reconciliation');
  });

  it('uploads and locks exact origin-support evidence', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    apiMock.post.mockResolvedValue({ id: 'evidence-1', status: 'locked' });
    await uploadOriginEvidence('shipment-1', new File(['supplier statement'], 'supplier.pdf'));
    await lockOriginEvidence('evidence/1');

    const request = apiMock.raw.mock.calls[0];
    expect(request[0]).toBe('/evidence/upload');
    expect(request[1].body.get('kind')).toBe('origin_support');
    expect(request[1].body.get('shipmentId')).toBe('shipment-1');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
