import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), raw: vi.fn()
}));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  createGpsrTechnicalFile, fetchGpsrPostMarketEvents, fetchGpsrTechnicalFiles, lockGpsrEvidence,
  recordGpsrPostMarketEvent, reviewGpsrTechnicalFile, uploadGpsrEvidence,
  type GpsrTechnicalFileInput
} from './shipmentExportApi';

const evidenceId = '11111111-1111-4111-8111-111111111111';
const input = { fileReference: 'GPSR-1' } as GpsrTechnicalFileInput;

describe('shipment R10 GPSR API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped file, review and post-market endpoints', async () => {
    await fetchGpsrTechnicalFiles('shipment/1');
    await createGpsrTechnicalFile('shipment/1', input);
    await reviewGpsrTechnicalFile('shipment/1', 'file/1', {
      reviewerRole: 'product_safety_reviewer', decision: 'approved_for_internal_release', notes: 'Approved.'
    });
    await fetchGpsrPostMarketEvents('shipment/1', 'file/1');
    await recordGpsrPostMarketEvent('shipment/1', 'file/1', {
      eventType: 'safety_incident', eventReference: 'INC-1', occurredAt: '2026-09-13T01:00:00Z',
      summary: 'Incident', severity: 'serious', consumerPersonalDataIncluded: false
    });
    const root = '/export/shipments/shipment%2F1/gpsr/technical-files';
    expect(apiMock.get).toHaveBeenCalledWith(root);
    expect(apiMock.post).toHaveBeenCalledWith(root, input);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/file%2F1/reviews`, expect.objectContaining({ reviewerRole: 'product_safety_reviewer' }));
    expect(apiMock.get).toHaveBeenCalledWith('/export/shipments/shipment%2F1/gpsr/post-market-events?technicalFileId=file%2F1');
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/file%2F1/post-market-events`, expect.objectContaining({ consumerPersonalDataIncluded: false }));
  });

  it('uploads and locks GPSR evidence', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: evidenceId } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    await uploadGpsrEvidence('shipment-1', new File(['memo'], 'gpsr.pdf'));
    await lockGpsrEvidence(evidenceId);
    expect(apiMock.raw.mock.calls[0][1].body.get('kind')).toBe('gpsr_technical_file');
    expect(apiMock.post).toHaveBeenCalledWith(`/evidence/${evidenceId}/lock`, {});
  });
});
