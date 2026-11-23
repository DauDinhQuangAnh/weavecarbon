import { describe, it, expect, vi } from 'vitest';
import { apiRequest } from '@/lib/apiClient';
import { extractDocumentWithContext } from './aiDocumentExtractor';
import { DOCUMENT_CONTEXTS } from './documentContext';

vi.mock('@/lib/apiClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    data: {
      kwh_total: 45000,
      detected_kind: 'electricity_bill',
      period_start: '2026-06-01',
      period_end: '2026-06-30',
      facility_name: 'Nhà máy Tân Bình',
      confidence: 0.97,
      source: 'gemini-vision-ocr',
      summary: 'Trích xuất hóa đơn điện EVN',
    },
  }),
}));

describe('aiDocumentExtractor', () => {
  it('correctly extracts facility context in demo mode', async () => {
    const file = new File(['content'], 'fac_permit.pdf', { type: 'application/pdf' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.facility, { demo: true });

    expect(result.success).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.fields.reference).toBeDefined();
    expect(result.fields.name).toBeDefined();
    expect(result.fields.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('correctly extracts process context in demo mode', async () => {
    const file = new File(['content'], 'process_sop.pdf', { type: 'application/pdf' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.process, { demo: true });

    expect(result.success).toBe(true);
    expect(result.fields.reference).toBe('PROC-EAF-STEEL-01');
    expect(result.fields.processType).toBe('production');
  });

  it('maps raw backend fields into context schema for emission activity', async () => {
    const file = new File(['real'], 'evn.pdf', { type: 'application/pdf' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.activity, { demo: false });

    expect(result.success).toBe(true);
    expect(result.fields.quantity).toBe(45000);
    expect(result.fields.canonicalUnit).toBe('kWh');
    expect(result.fields.periodStart).toBe('2026-06-01');
  });

  it('correctly extracts supplier context in demo mode', async () => {
    const file = new File(['content'], 'supplier_license.pdf', { type: 'application/pdf' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.supplier, { demo: true });

    expect(result.success).toBe(true);
    expect(result.fields.supplierReference).toBeDefined();
    expect(result.fields.legalName).toBeDefined();
    expect(result.fields.countryCode).toBe('VN');
  });

  it('correctly extracts mitigation context in demo mode', async () => {
    const file = new File(['content'], 'solar_proposal.pdf', { type: 'application/pdf' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.mitigation, { demo: true });

    expect(result.success).toBe(true);
    expect(result.fields.initiativeReference).toBe('MIT-SOLAR-2026-TB');
    expect(result.fields.targetReductionTco2e).toBe(1450);
  });
});

describe('aiDocumentExtractor production responses', () => {
  it('prefers context_fields returned by the backend and sends field definitions', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: {
        success: true,
        confidence: 0.93,
        source: 'gemini-vision',
        facility_name: null,
        context_fields: {
          reference: 'FAC-TU-02',
          name: 'Nhà máy Thủ Đức 2',
          timezone: 'Asia/Ho_Chi_Minh',
          boundary: 'Kiểm soát vận hành toàn bộ khu A',
        },
      },
    });
    const file = new File(['content'], 'facility.png', { type: 'image/png' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.facility, { demo: false });

    expect(result.success).toBe(true);
    expect(result.fields).toEqual({
      reference: 'FAC-TU-02',
      name: 'Nhà máy Thủ Đức 2',
      timezone: 'Asia/Ho_Chi_Minh',
      boundary: 'Kiểm soát vận hành toàn bộ khu A',
    });
    const body = vi.mocked(apiRequest).mock.calls.at(-1)?.[1]?.body as unknown as FormData;
    const context = JSON.parse(String(body.get('context')));
    expect(context.expectedFields[0]).toMatchObject({ key: 'reference', label: expect.any(String) });
  });

  it('returns no fields when the backend cannot read the document', async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({
      data: {
        success: false,
        extraction_status: 'unreadable',
        confidence: 0,
        source: 'heuristic',
        summary: 'Không đọc được nội dung tài liệu.',
      },
    });
    const file = new File(['%PDF-1.4 broken'], 'broken.pdf', { type: 'application/pdf' });
    const result = await extractDocumentWithContext(file, DOCUMENT_CONTEXTS.facility, { demo: false });

    expect(result.success).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.fields).toEqual({});
  });
});
