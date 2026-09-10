import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), raw: vi.fn()
}));

vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  emptyVnCustomsProfile,
  fetchVnCustomsEvents,
  fetchVnCustomsReconciliation,
  lockVnCustomsEvidence,
  recordVnCustomsEvent,
  saveVnCustomsProfile,
  uploadVnCustomsEvidence
} from './shipmentExportApi';

describe('shipment Vietnam customs handoff API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped profile, reconciliation and event endpoints', async () => {
    const profile = emptyVnCustomsProfile();
    apiMock.put.mockResolvedValue(profile);
    apiMock.get.mockResolvedValue({ status: 'failed' });
    apiMock.post.mockResolvedValue({ id: 'event-1' });

    await saveVnCustomsProfile('shipment/1', profile);
    await fetchVnCustomsReconciliation('shipment/1');
    await fetchVnCustomsEvents('shipment/1');
    await recordVnCustomsEvent('shipment/1', {
      exportDocumentId: 'document-1',
      eventType: 'authority_accepted',
      externalReference: 'VNACCS-REF-1',
      evidenceDocumentId: 'evidence-1',
      actorName: 'Customs authority',
      occurredAt: '2026-09-10T03:00:00.000Z'
    });

    expect(apiMock.put).toHaveBeenCalledWith('/export/shipments/shipment%2F1/vn-customs/profile', profile);
    expect(apiMock.get).toHaveBeenNthCalledWith(1, '/export/shipments/shipment%2F1/vn-customs/reconciliation');
    expect(apiMock.get).toHaveBeenNthCalledWith(2, '/export/shipments/shipment%2F1/vn-customs/events');
    expect(apiMock.post).toHaveBeenCalledWith('/export/shipments/shipment%2F1/vn-customs/events', expect.objectContaining({
      eventType: 'authority_accepted',
      evidenceDocumentId: 'evidence-1'
    }));
  });

  it('uploads and locks exact evidence through the existing evidence APIs', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));
    apiMock.post.mockResolvedValue({ id: 'evidence-1', status: 'locked' });

    const file = new File(['authority response'], 'response.json', { type: 'application/json' });
    await uploadVnCustomsEvidence('shipment-1', file, 'customs_authority_response');
    await lockVnCustomsEvidence('evidence/1');

    const request = apiMock.raw.mock.calls[0];
    expect(request[0]).toBe('/evidence/upload');
    expect(request[1].method).toBe('POST');
    expect(request[1].body).toBeInstanceOf(FormData);
    expect(request[1].body.get('shipmentId')).toBe('shipment-1');
    expect(request[1].body.get('kind')).toBe('customs_authority_response');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
