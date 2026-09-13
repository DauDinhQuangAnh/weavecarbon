import { beforeEach, describe, expect, it, vi } from 'vitest';
const apiMock = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), raw: vi.fn() }));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));
import { createPcfStudy, fetchPcfCalculationSnapshots, fetchPcfStudies, lockPcfStudyEvidence,
  reviewPcfStudy, uploadPcfStudyEvidence, type PcfStudyInput } from './shipmentExportApi';

describe('shipment R12 PCF study API', () => {
  beforeEach(() => vi.clearAllMocks());
  it('uses shipment-scoped calculation, study and practitioner-review endpoints', async () => {
    const input = { studyReference: 'PCF-1' } as PcfStudyInput;
    await fetchPcfCalculationSnapshots('shipment/1'); await fetchPcfStudies('shipment/1');
    await createPcfStudy('shipment/1', input);
    await reviewPcfStudy('shipment/1', 'study/1', {
      reviewerRole: 'pcf_practitioner_reviewer', decision: 'approved_for_internal_report', notes: 'Reviewed.'
    });
    const root = '/export/shipments/shipment%2F1/pcf';
    expect(apiMock.get).toHaveBeenCalledWith(`${root}/calculation-snapshots`);
    expect(apiMock.get).toHaveBeenCalledWith(`${root}/studies`);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/studies`, input);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/studies/study%2F1/reviews`,
      expect.objectContaining({ reviewerRole: 'pcf_practitioner_reviewer' }));
  });
  it('uploads and locks PCF source evidence', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), { status: 200 }));
    await uploadPcfStudyEvidence('shipment-1', new File(['pcf'], 'pcf.pdf')); await lockPcfStudyEvidence('evidence/1');
    expect(apiMock.raw.mock.calls[0][1].body.get('kind')).toBe('pcf_source');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
