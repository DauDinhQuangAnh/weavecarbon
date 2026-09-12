import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), raw: vi.fn()
}));

vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  emptyIcs2Profile,
  fetchIcs2Events,
  fetchIcs2Reconciliation,
  lockIcs2Evidence,
  recordIcs2Event,
  saveIcs2Profile,
  uploadIcs2Evidence
} from './shipmentExportApi';

describe('shipment ICS2 filing handoff API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped R06 profile, reconciliation and event endpoints', async () => {
    const profile = emptyIcs2Profile();
    apiMock.put.mockResolvedValue(profile);
    apiMock.get.mockResolvedValue({ status: 'blocked' });
    apiMock.post.mockResolvedValue({ id: 'event-1' });

    await saveIcs2Profile('shipment/1', profile);
    await fetchIcs2Reconciliation('shipment/1');
    await fetchIcs2Events('shipment/1');
    await recordIcs2Event('shipment/1', {
      exportDocumentId: 'document-1', eventType: 'authority_registered',
      externalReference: 'MRN-EXTERNAL-1', evidenceDocumentId: 'evidence-1',
      actorName: 'ICS2', occurredAt: '2026-09-12T03:00:00.000Z'
    });

    expect(profile).toMatchObject({
      filingPurpose: 'filer_handoff', ics2Release: 'R3',
      htiAgreementRef: 'EU-ICS2-TI-V2.0', messageDatasetCode: 'F11'
    });
    expect(apiMock.put).toHaveBeenCalledWith('/export/shipments/shipment%2F1/ics2/profile', expect.objectContaining({
      messageDatasetCode: 'F11', targetSystemSchemaId: '', houseConsignments: []
    }));
    expect(apiMock.put.mock.calls[0][1]).not.toHaveProperty('schemaId');
    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/export/shipments/shipment%2F1/ics2/reconciliation');
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/export/shipments/shipment%2F1/ics2/events');
    expect(apiMock.post).toHaveBeenCalledWith('/export/shipments/shipment%2F1/ics2/events', expect.objectContaining({
      eventType: 'authority_registered', evidenceDocumentId: 'evidence-1'
    }));
  });

  it('uploads and locks exact filer evidence through existing evidence APIs', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    apiMock.post.mockResolvedValue({ id: 'evidence-1', status: 'locked' });

    const file = new File(['IE3N99'], 'response.xml', { type: 'application/xml' });
    await uploadIcs2Evidence('shipment-1', file, 'ics2_customs_response');
    await lockIcs2Evidence('evidence/1');

    const request = apiMock.raw.mock.calls[0];
    expect(request[0]).toBe('/evidence/upload');
    expect(request[1].method).toBe('POST');
    expect(request[1].body).toBeInstanceOf(FormData);
    expect(request[1].body.get('shipmentId')).toBe('shipment-1');
    expect(request[1].body.get('kind')).toBe('ics2_customs_response');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
