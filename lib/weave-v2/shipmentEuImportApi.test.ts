import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), raw: vi.fn()
}));

vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  emptyEuImportProfile,
  fetchEuImportEvents,
  fetchEuImportReconciliation,
  lockEuImportEvidence,
  recordEuImportEvent,
  saveEuImportLineDetail,
  saveEuImportProfile,
  uploadEuImportEvidence
} from './shipmentExportApi';

describe('shipment EU import declarant handoff API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped R05 profile, line, reconciliation and event endpoints', async () => {
    const profile = emptyEuImportProfile();
    apiMock.put.mockResolvedValue(profile);
    apiMock.get.mockResolvedValue({ status: 'failed' });
    apiMock.post.mockResolvedValue({ id: 'event-1' });

    await saveEuImportProfile('shipment/1', profile);
    await saveEuImportLineDetail('shipment/1', 'line/1', {
      taricCode: '6205200010', taricConfirmed: false
    });
    await fetchEuImportReconciliation('shipment/1');
    await fetchEuImportEvents('shipment/1');
    await recordEuImportEvent('shipment/1', {
      exportDocumentId: 'document-1', eventType: 'authority_accepted',
      externalReference: 'MRN-EXTERNAL-1', evidenceDocumentId: 'evidence-1',
      actorName: 'EU customs authority', occurredAt: '2026-09-12T03:00:00.000Z'
    });

    expect(profile).toMatchObject({
      filingPurpose: 'declarant_handoff', targetSystemSchemaId: '',
      regulatoryBasisVersion: expect.stringContaining('EUCDM-7.0.11')
    });
    expect(apiMock.put).toHaveBeenNthCalledWith(1, '/export/shipments/shipment%2F1/eu-import/profile', expect.objectContaining({
      memberStateCode: '', targetSystemSchemaId: '', preferenceClaimStatus: 'no_claim'
    }));
    expect(apiMock.put.mock.calls[0][1]).not.toHaveProperty('schemaId');
    expect(apiMock.put).toHaveBeenNthCalledWith(2, '/export/shipments/shipment%2F1/eu-import/lines/line%2F1', expect.objectContaining({ taricConfirmed: false }));
    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/export/shipments/shipment%2F1/eu-import/reconciliation');
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/export/shipments/shipment%2F1/eu-import/events');
    expect(apiMock.post).toHaveBeenCalledWith('/export/shipments/shipment%2F1/eu-import/events', expect.objectContaining({
      eventType: 'authority_accepted', evidenceDocumentId: 'evidence-1'
    }));
  });

  it('uploads and locks exact EU declarant evidence through existing evidence APIs', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    apiMock.post.mockResolvedValue({ id: 'evidence-1', status: 'locked' });

    const file = new File(['declarant response'], 'response.xml', { type: 'application/xml' });
    await uploadEuImportEvidence('shipment-1', file, 'eu_declarant_response');
    await lockEuImportEvidence('evidence/1');

    const request = apiMock.raw.mock.calls[0];
    expect(request[0]).toBe('/evidence/upload');
    expect(request[1].method).toBe('POST');
    expect(request[1].body).toBeInstanceOf(FormData);
    expect(request[1].body.get('shipmentId')).toBe('shipment-1');
    expect(request[1].body.get('kind')).toBe('eu_declarant_response');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
