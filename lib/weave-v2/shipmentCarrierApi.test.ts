import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), patch: vi.fn(), get: vi.fn(), delete: vi.fn(), raw: vi.fn()
}));

vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  confirmCarrierDocument,
  createCarrierDocumentMetadata,
  deleteCarrierDocumentMetadata,
  fetchCarrierDocumentReconciliation,
  updateCarrierDocumentMetadata,
  type CarrierDocumentMetadata
} from './shipmentExportApi';

const draft = {
  evidenceDocumentId: 'evidence-1',
  documentType: 'bill_of_lading',
  transportMode: 'sea',
  documentNumber: 'BL-1'
} as CarrierDocumentMetadata;

describe('shipment carrier document API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped metadata and reconciliation endpoints', async () => {
    apiMock.post.mockResolvedValue({ id: 'carrier-1' });
    apiMock.patch.mockResolvedValue({ id: 'carrier-1' });
    apiMock.get.mockResolvedValue({ status: 'passed' });
    apiMock.delete.mockResolvedValue({ deleted: true });

    await createCarrierDocumentMetadata('shipment/1', draft);
    await updateCarrierDocumentMetadata('shipment/1', 'carrier/1', { issuerName: 'Carrier' });
    await fetchCarrierDocumentReconciliation('shipment/1', 'carrier/1');
    await deleteCarrierDocumentMetadata('shipment/1', 'carrier/1');

    expect(apiMock.post).toHaveBeenCalledWith('/export/shipments/shipment%2F1/carrier-documents', draft);
    expect(apiMock.patch).toHaveBeenCalledWith('/export/shipments/shipment%2F1/carrier-documents/carrier%2F1', { issuerName: 'Carrier' });
    expect(apiMock.get).toHaveBeenCalledWith('/export/shipments/shipment%2F1/carrier-documents/carrier%2F1/reconciliation');
    expect(apiMock.delete).toHaveBeenCalledWith('/export/shipments/shipment%2F1/carrier-documents/carrier%2F1');
  });

  it('requires explicit confirmation text through the admin confirmation endpoint', async () => {
    apiMock.post.mockResolvedValue({ id: 'carrier-1', status: 'confirmed' });
    await confirmCarrierDocument('shipment-1', 'carrier/1', {
      metadataConfirmed: true,
      confirmationNote: 'Matched against carrier PDF.'
    });
    expect(apiMock.post).toHaveBeenCalledWith(
      '/export/shipments/shipment-1/carrier-documents/carrier%2F1/confirm',
      { metadataConfirmed: true, confirmationNote: 'Matched against carrier PDF.' }
    );
  });
});
