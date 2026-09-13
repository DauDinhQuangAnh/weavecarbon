import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/apiClient';
import { createEuTextileEprAssessment, fetchEuTextileEprAssessments,
  recordEuTextileEprExternalEvent, reviewEuTextileEprAssessment, type EuTextileEprInput } from './euTextileEprApi';

vi.mock('@/lib/apiClient', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

describe('euTextileEprApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the company-scoped EPR assessment collection', async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    await fetchEuTextileEprAssessments();
    expect(api.get).toHaveBeenCalledWith('/eu-textile-epr/assessments');
  });

  it('creates a revision and records only encoded review/external-event routes', async () => {
    vi.mocked(api.post).mockResolvedValue({});
    const input = { assessmentReference: 'EPR-NL-2026' } as EuTextileEprInput;
    await createEuTextileEprAssessment(input);
    await reviewEuTextileEprAssessment('assessment id/1', { reviewerRole: 'eu_epr_specialist',
      decision: 'approved_for_internal_planning', notes: 'Reviewed.' });
    await recordEuTextileEprExternalEvent('assessment id/1', { eventType: 'authority_registration_confirmed',
      externalReference: 'NL-REG-1', actorName: 'Authority', occurredAt: '2026-09-13T00:00:00Z',
      evidenceDocumentId: '10000000-0000-4000-8000-000000000001' });
    expect(api.post).toHaveBeenNthCalledWith(1, '/eu-textile-epr/assessments', input);
    expect(api.post).toHaveBeenNthCalledWith(2, '/eu-textile-epr/assessments/assessment%20id%2F1/reviews', expect.any(Object));
    expect(api.post).toHaveBeenNthCalledWith(3, '/eu-textile-epr/assessments/assessment%20id%2F1/external-events', expect.objectContaining({ externalReference: 'NL-REG-1' }));
  });
});
