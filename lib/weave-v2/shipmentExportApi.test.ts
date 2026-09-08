import { describe, expect, it } from 'vitest';
import { emptyShipmentExportProfile } from './shipmentExportApi';

describe('shipment export profile defaults', () => {
  it('starts new invoice and packing-list fields empty and never with sample data', () => {
    const profile = emptyShipmentExportProfile();

    expect(profile).toMatchObject({
      invoiceNumber: '',
      invoiceIssuePlace: '',
      packingListNumber: '',
      packingListDate: null,
      discountAmount: null,
      surchargeAmount: null,
      transportMode: '',
      exporter: {},
      importer: {},
      consignee: {},
      notifyParty: {}
    });
    expect(JSON.stringify(profile)).not.toMatch(/demo|sample|SGS/i);
  });
});
