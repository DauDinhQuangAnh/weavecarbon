import { describe, it, expect, vi } from 'vitest';
import {
  analyzeExportDocument,
  applyAiDataToProfile,
  getExportAiSamplePresets,
  type ExportAiExtractedData,
} from './exportAiService';
import { emptyShipmentExportProfile } from '@/lib/weave-v2/shipmentExportApi';

vi.mock('@/lib/apiClient', () => ({
  apiRequest: vi.fn().mockResolvedValue({
    data: {
      invoice_number: 'INV-TEST-001',
      period_start: '2026-06-20',
      facility_name: 'Tan Binh Port',
      carrier_name: 'ONE Line',
      bl_number: 'ONE-BL-99',
      port_of_loading: 'Cat Lai Port',
      port_of_discharge: 'Rotterdam Port',
      total_amount: 1500,
      currency: 'USD',
      supplier_name: 'WeaveCarbon Test Co',
      customer_name: 'EU Fashion Buyer',
      confidence: 0.98,
      source: 'gemini-vision',
      summary: 'Test summary from AI OCR',
    },
  }),
}));

describe('exportAiService', () => {
  it('returns valid demo presets for export documents', () => {
    const presets = getExportAiSamplePresets();
    expect(presets.length).toBe(3);
    expect(presets[0].id).toBe('invoice');
    expect(presets[0].data.invoiceNumber).toBe('INV-2026-EU-089');
    expect(presets[1].id).toBe('bill_of_lading');
    expect(presets[1].data.billOfLadingNo).toBe('MSK-VNSGN-2026-88');
    expect(presets[2].id).toBe('customs');
    expect(presets[2].data.customsDeclarationNo).toBe('304928174829');
  });

  it('correctly maps AI extracted data into an existing ShipmentExportProfile', () => {
    const current = emptyShipmentExportProfile();
    const aiData: ExportAiExtractedData = {
      invoiceNumber: 'INV-AI-2026',
      invoiceDate: '2026-07-01',
      incotermCode: 'CIF',
      incotermLocation: 'Rotterdam',
      portOfLoading: 'Cat Lai, VN',
      portOfDischarge: 'Rotterdam, NL',
      carrierName: 'Ocean Network Express',
      billOfLadingNo: 'BL-888999',
      freightAmount: 2500,
      exporter: {
        name: 'WeaveCarbon VN',
        country: 'VN',
      },
      importer: {
        name: 'Nordic Fashion B.V.',
        country: 'NL',
      },
      confidence: 0.95,
      source: 'gemini-vision-ocr',
      documentTitle: 'Commercial Invoice',
      detectedKind: 'commercial_invoice',
      summary: 'Extracted successfully',
    };

    const updated = applyAiDataToProfile(aiData, current);
    expect(updated.invoiceNumber).toBe('INV-AI-2026');
    expect(updated.invoiceDate).toBe('2026-07-01');
    expect(updated.incotermCode).toBe('CIF');
    expect(updated.incotermLocation).toBe('Rotterdam');
    expect(updated.carrierName).toBe('Ocean Network Express');
    expect(updated.billOfLadingNo).toBe('BL-888999');
    expect(updated.freightAmount).toBe(2500);
    expect(updated.exporter.name).toBe('WeaveCarbon VN');
    expect(updated.importer.name).toBe('Nordic Fashion B.V.');
  });

  it('analyzes file using simulated preset in demo mode', async () => {
    const file = new File(['mock content'], 'test_invoice.pdf', { type: 'application/pdf' });
    const result = await analyzeExportDocument(file, { demo: true });

    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.invoiceNumber).toBe('INV-2026-EU-089');
    expect(result.portOfLoading).toContain('Cat Lai');
  });

  it('selects bill of lading preset if filename contains bol or bill', async () => {
    const file = new File(['mock content'], 'ocean_bol_shipment.pdf', { type: 'application/pdf' });
    const result = await analyzeExportDocument(file, { demo: true });

    expect(result.detectedKind).toBe('transport_bol');
    expect(result.billOfLadingNo).toBe('MSK-VNSGN-2026-88');
  });

  it('calls real apiRequest in non-demo mode and maps fields accurately', async () => {
    const file = new File(['real content'], 'invoice.pdf', { type: 'application/pdf' });
    const result = await analyzeExportDocument(file, { demo: false });

    expect(result.invoiceNumber).toBe('INV-TEST-001');
    expect(result.carrierName).toBe('ONE Line');
    expect(result.billOfLadingNo).toBe('ONE-BL-99');
    expect(result.exporter?.name).toBe('WeaveCarbon Test Co');
    expect(result.importer?.name).toBe('EU Fashion Buyer');
  });
});
