// @vitest-environment jsdom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { promotionApi, coreApi } = vi.hoisted(() => ({
  promotionApi: {
    reviews: vi.fn(), suggestions: vi.fn(), candidates: vi.fn(),
    createCandidate: vi.fn(), promote: vi.fn(),
  },
  coreApi: {
    facilities: vi.fn(), processes: vi.fn(), measurementPoints: vi.fn(),
  },
}));

vi.mock('@/hooks/useToast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/evidenceActivityPromotionApi', () => ({
  evidenceActivityPromotionApi: promotionApi,
}));
vi.mock('@/lib/industrialCoreApi', () => ({ industrialCoreApi: coreApi }));

import ControlledActivityPromotionPanel from './ControlledActivityPromotionPanel';

describe('ControlledActivityPromotionPanel behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    promotionApi.reviews.mockResolvedValue([{
      id: 'review-1', decision: 'approved_for_mapping', reviewerName: 'Named Reviewer',
      reviewerRole: 'evidence_ai_reviewer', fields: [],
    }]);
    promotionApi.candidates.mockResolvedValue([]);
    promotionApi.suggestions.mockResolvedValue({
      engine: 'weavecarbon.governed-semantic-mapper', engineVersion: '1.0.0',
      evidenceDocumentId: 'evidence-1', extractionReviewId: 'review-1',
      evidenceChecksumSha256: 'a'.repeat(64), extractionSha256: 'b'.repeat(64),
      suggestionSha256: 'c'.repeat(64),
      fields: [{
        fieldPath: 'kwh_total', confirmedValue: 1200, fieldDecision: 'accepted',
        suggestedCanonicalField: 'quantity', confidence: 0.9, rationale: 'Governed label rule.',
      }],
      evidenceMatches: [
        { evidenceDocumentId: 'evidence-1', relationship: 'source_document', confidence: 1, rationale: 'Source.' },
        {
          evidenceDocumentId: 'evidence-2', relationship: 'supports_activity', confidence: 0.75,
          rationale: 'Same product and reporting period.',
          evidence: { id: 'evidence-2', documentName: 'support.pdf', evidenceType: 'meter_export', status: 'locked', checksumSha256: 'd'.repeat(64), fileSizeBytes: 20, relationship: 'supports_activity' },
        },
      ],
    });
    coreApi.facilities.mockResolvedValue([]);
    coreApi.processes.mockResolvedValue([]);
    coreApi.measurementPoints.mockResolvedValue([]);
  });

  it('requires an explicit accept/reject decision and rationale for every evidence suggestion', async () => {
    render(<ControlledActivityPromotionPanel evidenceId="evidence-1" />);

    expect(await screen.findByText('support.pdf')).toBeTruthy();
    const createButton = screen.getByRole('button', { name: /Tạo candidate bất biến/i });
    expect((createButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Quyết định evidence match'), {
      target: { value: 'accepted' },
    });
    fireEvent.change(screen.getByPlaceholderText('Lý do quyết định (tối thiểu 10 ký tự)'), {
      target: { value: 'Đã đối chiếu chứng từ hỗ trợ với kỳ hoạt động.' },
    });

    await waitFor(() => expect((createButton as HTMLButtonElement).disabled).toBe(false));
  });
});
