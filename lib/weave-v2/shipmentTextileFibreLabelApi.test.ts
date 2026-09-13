import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.hoisted(() => ({
  post: vi.fn(), put: vi.fn(), get: vi.fn(), patch: vi.fn(), delete: vi.fn(), raw: vi.fn()
}));
vi.mock('@/lib/apiClient', () => ({ api: apiMock }));

import {
  createTextileFibreLabelSpecification, fetchTextileFibreLabelSpecifications,
  lockTextileFibreLabelEvidence, reviewTextileFibreLabelSpecification,
  uploadTextileFibreLabelEvidence, type TextileFibreLabelInput
} from './shipmentExportApi';

const input: TextileFibreLabelInput = {
  specificationReference: 'LABEL-1', assessmentDate: '2026-09-13', productReference: 'SKU-1',
  productCategory: 'shirt', specialProductCategory: 'standard', textileFibrePercent: 100, marketCodes: ['DE'],
  components: [{ componentReference: 'shell', componentName: 'Shell', weightPercent: 100,
    mainLining: false, fibres: [{ fibreCode: '5', percentage: 100 }] }],
  animalOriginPresence: 'absent',
  languageLabels: [{ marketCode: 'DE', languageCode: 'de-DE', labelText: '100% Baumwolle',
    animalOriginStatementIncluded: false, operatorApproved: true }],
  economicOperator: { role: 'importer', name: 'Importer GmbH', address: 'Berlin' },
  placement: { method: 'sewn', durable: true, easilyLegible: true, visible: true,
    accessible: true, securelyAttached: true, onlineBeforePurchase: true },
  evidenceDocumentIds: ['11111111-1111-4111-8111-111111111111'], notes: ''
};

describe('shipment R08 textile fibre label API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses shipment-scoped immutable specification and review endpoints', async () => {
    await fetchTextileFibreLabelSpecifications('shipment/1');
    await createTextileFibreLabelSpecification('shipment/1', input);
    await reviewTextileFibreLabelSpecification('shipment/1', 'specification/1', {
      reviewerRole: 'textile_label_reviewer', decision: 'approved_for_internal_artwork', notes: 'Approved.'
    });
    const root = '/export/shipments/shipment%2F1/textile-fibre-labels';
    expect(apiMock.get).toHaveBeenCalledWith(root);
    expect(apiMock.post).toHaveBeenCalledWith(root, input);
    expect(apiMock.post).toHaveBeenCalledWith(`${root}/specification%2F1/reviews`, expect.objectContaining({
      reviewerRole: 'textile_label_reviewer', decision: 'approved_for_internal_artwork'
    }));
  });

  it('uploads and locks composition evidence', async () => {
    apiMock.raw.mockResolvedValue(new Response(JSON.stringify({ data: { id: 'evidence-1' } }), {
      status: 200, headers: { 'content-type': 'application/json' }
    }));
    await uploadTextileFibreLabelEvidence('shipment-1', new File(['memo'], 'composition.pdf'));
    await lockTextileFibreLabelEvidence('evidence/1');
    expect(apiMock.raw.mock.calls[0][1].body.get('kind')).toBe('textile_composition_test');
    expect(apiMock.post).toHaveBeenCalledWith('/evidence/evidence%2F1/lock', {});
  });
});
