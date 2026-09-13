import { beforeEach, describe, expect, it, vi } from 'vitest';
const apiMock = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), raw: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));
import { createReachSvhcDossier, fetchReachObligationEvents, fetchReachSvhcDossiers, lockReachEvidence,
  recordReachObligationEvent, reviewReachSvhcDossier, uploadReachEvidence, type ReachSvhcDossierInput } from './shipmentExportApi';

describe('shipment R11 REACH/SVHC API', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses shipment-scoped immutable dossier, review and obligation endpoints', async () => {
    const input = { dossierReference: 'REACH-1' } as ReachSvhcDossierInput;
    await fetchReachSvhcDossiers('shipment/1'); await createReachSvhcDossier('shipment/1', input);
    await reviewReachSvhcDossier('shipment/1', 'dossier/1', { reviewerRole: 'chemical_compliance_reviewer', decision: 'approved_for_internal_release', notes: 'Approved.' });
    await fetchReachObligationEvents('shipment/1', 'dossier/1');
    await recordReachObligationEvent('shipment/1', 'dossier/1', { eventType: 'consumer_request_received', eventReference: 'REQ-1', occurredAt: '2026-09-13T00:00:00Z', summary: 'Opaque request.', consumerPersonalDataIncluded: false });
    const root = '/export/shipments/shipment%2F1/reach/dossiers';
    expect(apiMock.get).toHaveBeenCalledWith(root); expect(apiMock.post).toHaveBeenCalledWith(root, input);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/dossier%2F1/reviews`, expect.objectContaining({ reviewerRole: 'chemical_compliance_reviewer' }));
    expect(apiMock.get).toHaveBeenCalledWith('/export/shipments/shipment%2F1/reach/obligation-events?dossierId=dossier%2F1');
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/dossier%2F1/obligation-events`, expect.objectContaining({ consumerPersonalDataIncluded: false }));
  });
  it('uploads and locks chemical evidence', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await uploadReachEvidence('shipment-1', new File(['lab'], 'lab.pdf')); await lockReachEvidence('evidence/1');
    expect(apiMock.raw.mock.calls[0][1].body.get('kind')).toBe('reach_lab_report');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
