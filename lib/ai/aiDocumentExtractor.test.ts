import { describe, it, expect, vi } from 'vitest';
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
    expect(result.fields.reference).toBe('PROC-DYE-COTTON-01');
    expect(result.fields.processType).toBe('dyeing_washing');
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
