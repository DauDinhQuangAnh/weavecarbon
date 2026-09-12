import { api } from '@/lib/apiClient';

export type ExportDocumentType =
  | 'commercial_invoice'
  | 'packing_list'
  | 'carbon_annex'
  | 'origin_workbook'
  | 'ics2_dataset'
  | 'vn_customs_handoff'
  | 'eu_import_handoff';

export type ExportOutputFormat = 'xlsx' | 'pdf' | 'csv' | 'json';
export type CarrierDocumentType = 'bill_of_lading' | 'fbl' | 'air_waybill' | 'cmr' | 'cim';
export type CarrierTransportMode = 'sea' | 'air' | 'road' | 'rail' | 'multimodal';

export interface ExportParty {
  name?: string;
  address?: string;
  country?: string;
  contact?: string;
  taxId?: string;
}

export interface ShipmentExportProfile {
  id?: string;
  shipmentId?: string;
  targetMarket: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  invoiceIssuePlace: string;
  packingListNumber: string;
  packingListDate: string | null;
  poContractId: string;
  incotermCode: string;
  incotermLocation: string;
  incotermVersion: string;
  currency: string;
  paymentTerms: string;
  exporter: ExportParty;
  importer: ExportParty;
  consignee: ExportParty;
  notifyParty: ExportParty;
  exporterTaxId: string;
  importerEori: string;
  importerVatId: string;
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  vesselName: string;
  voyageNumber: string;
  carrierName: string;
  billOfLadingNo: string;
  containerNo: string;
  sealNo: string;
  customsDeclarationNo: string;
  freightAmount: number | null;
  insuranceAmount: number | null;
  discountAmount: number | null;
  surchargeAmount: number | null;
  customsValueAmount: number | null;
  customsValueBasis: string;
  transportMode: string;
  preferentialOriginClaim: boolean;
  metadata: Record<string, unknown>;
}

export interface ShipmentExportLine {
  id: string;
  lineNumber: number;
  sku: string;
  goodsDescription: string;
  hsCode: string;
  originCountry: string;
  styleCode: string;
  sizeLabel: string;
  colorLabel: string;
  lotNumber: string;
  hsCodeConfirmed: boolean;
  hsCodeSource: string;
  hsCodeRuleset: string;
  hsCodeEffectiveDate: string | null;
  hsCodeConfirmedBy: string | null;
  hsCodeConfirmedAt: string | null;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  currency: string;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  embeddedCo2eKg: number | null;
  packageRefs?: Array<{ packageNumber: string; quantity: number }>;
  carbonAuthority: {
    authoritative: true;
    snapshotId: string;
    snapshotVersion: number;
    engineVersion: string;
    methodologyVersion: string;
    factorRegistryVersion: string;
    gwpBasis: string;
    boundary: string;
    canonicalInputHash: string;
    factorSnapshot: unknown[];
    allocationMethod: string;
  } | null;
}

export interface CarrierDocumentMetadata {
  id?: string;
  evidenceDocumentId: string;
  documentType: CarrierDocumentType;
  contractLevel: 'master' | 'house' | 'direct';
  transportMode: CarrierTransportMode;
  documentNumber: string;
  version?: number;
  status?: 'draft' | 'confirmed' | 'superseded' | 'rejected';
  issuerName: string;
  issuerIdentifier: string;
  issueDate: string | null;
  issuePlace: string;
  onBoardDate: string | null;
  shipper: ExportParty;
  consignee: ExportParty;
  notifyParty: ExportParty;
  vesselName: string;
  voyageNumber: string;
  flightNumber: string;
  vehicleRegistration: string;
  trainNumber: string;
  placeOfReceipt: string;
  placeOfLoading: string;
  placeOfDischarge: string;
  placeOfDelivery: string;
  goodsDescription: string;
  packageCount: number | null;
  packageType: string;
  marksAndNumbers: string;
  grossWeightKg: number | null;
  measurementCbm: number | null;
  containerNumbers: string[];
  sealNumbers: string[];
  freightTerms: 'prepaid' | 'collect' | 'other' | '';
  paymentTerms: string;
  authenticationMethod: string;
  authenticationReference: string;
  authenticityStatus: 'unverified' | 'operator_confirmed' | 'issuer_verified' | 'rejected';
  originalStatus: 'original' | 'copy' | 'electronic' | 'sea_waybill' | 'non_negotiable' | 'unknown';
  negotiable: boolean | null;
  metadataSource: 'manual' | 'ocr_confirmed' | 'carrier_api';
  metadata: Record<string, unknown>;
  supersedesId: string | null;
  confirmerName?: string | null;
  confirmationNote?: string | null;
  confirmedAt?: string | null;
}

export interface CarrierReconciliationCheck {
  code: string;
  status: 'ready' | 'missing' | 'invalid';
  message: string | null;
  fieldPath: string;
  expected: unknown;
  actual: unknown;
  blocking: boolean;
}

export interface CarrierDocumentReconciliation {
  status: 'passed' | 'failed';
  checks: CarrierReconciliationCheck[];
  rulesetVersion: string;
  sourceSnapshotSha256: string;
  confirmedAndCurrent: boolean;
  summary: {
    expectedPackageCount: number;
    expectedGrossWeightKg: number;
    expectedMeasurementCbm: number;
    expectedContainerNumbers: string[];
    expectedSealNumbers: string[];
  };
}

export interface CarrierEvidenceDocument {
  id: string;
  type: string;
  name: string;
  status: string;
  checksumSha256?: string | null;
  fileSizeBytes?: number;
  validFrom?: string | null;
  validTo?: string | null;
  structured: CarrierDocumentMetadata | null;
  latestReconciliation: (CarrierDocumentReconciliation & {
    id: string;
    reconcilerName: string;
    reconciledAt: string;
  }) | null;
}

export interface VnCustomsProfile {
  id?: string;
  shipmentId?: string;
  updatedAt?: string;
  schemaId: 'weavecarbon.vn-export-broker-handoff';
  schemaVersion: '1.0.0';
  rulesetVersion: string;
  regulatoryBasisVersion: string;
  filingPurpose: 'broker_handoff';
  declarant: ExportParty & { role?: 'exporter' | 'customs_broker' };
  customsBroker: ExportParty & { code?: string };
  customsOfficeCode: string;
  declarationTypeCode: string;
  cargoClassificationCode: string;
  transportMethodCode: string;
  exitCustomsOfficeCode: string;
  loadingLocationCode: string;
  destinationCountryCode: string;
  invoiceClassificationCode: string;
  invoicePaymentMethodCode: string;
  exchangeRate: number | null;
  permitRequirementStatus: 'unknown' | 'not_required' | 'required';
  permitReferences: Array<Record<string, unknown>>;
  inspectionRequirementStatus: 'unknown' | 'not_required' | 'required';
  inspectionReferences: Array<Record<string, unknown>>;
  taxTreatment: 'unknown' | 'not_subject' | 'exempt' | 'taxable';
  exportDutyRate: number | null;
  exportDutyAmount: number | null;
  taxBasis: string;
  supportingDocuments: Array<Record<string, unknown>>;
  brokerTargetSchemaId: string;
  brokerTargetSchemaVersion: string;
  declarationNotes: string;
  metadata: Record<string, unknown>;
}

export type VnCustomsEventType =
  | 'broker_received' | 'broker_validated' | 'broker_rejected'
  | 'authority_submitted' | 'authority_accepted' | 'authority_rejected'
  | 'authority_released' | 'authority_cancelled'
  | 'amendment_requested' | 'amendment_submitted';

export interface VnCustomsExternalEvent {
  id: string;
  shipmentId: string;
  exportDocumentId: string;
  eventType: VnCustomsEventType;
  sourceType: 'broker' | 'authority';
  externalReference: string;
  messageCode: string;
  messageText: string;
  evidenceDocumentId: string;
  evidenceSha256: string;
  evidenceFileSizeBytes: number;
  documentPayloadSha256: string;
  documentFileSha256: string;
  actorName: string;
  actorIdentifier: string;
  occurredAt: string;
  recorderName: string;
  recorderEmail: string | null;
  createdAt: string;
}

export interface VnCustomsReconciliation {
  status: 'passed' | 'failed';
  rulesetVersion: string;
  sourceSnapshotSha256: string;
  schema: { id: string; version: string; regulatoryBasisVersion: string };
  checks: CarrierReconciliationCheck[];
  summary: {
    goodsLineCount: number;
    packageCount: number;
    netWeightKg: number;
    grossWeightKg: number;
    invoiceTotal: number;
    customsValue: number | null;
    carrierDocumentId: string | null;
  };
}

export interface EuImportParty extends ExportParty {
  eori?: string;
}

export interface EuImportProfile {
  id?: string;
  shipmentId?: string;
  updatedAt?: string;
  schemaId: 'weavecarbon.eu-import-declarant-handoff';
  schemaVersion: '1.0.0';
  rulesetVersion: string;
  regulatoryBasisVersion: string;
  filingPurpose: 'declarant_handoff';
  memberStateCode: string;
  importer: EuImportParty;
  declarant: EuImportParty;
  representative: EuImportParty;
  representationType: 'none' | 'direct' | 'indirect';
  customsOfficeCode: string;
  declarationDatasetCode: string;
  additionalDeclarationType: string;
  requestedProcedureCode: string;
  previousProcedureCode: string;
  modeOfTransportAtBorder: string;
  inlandModeOfTransport: string;
  borderTransportIdentity: string;
  placeOfGoodsCode: string;
  deliveryTermsLocation: string;
  valuationMethodCode: string;
  exchangeRate: number | null;
  customsValueCurrency: string;
  customsValueAmount: number | null;
  dutyTreatment: 'unknown' | 'not_subject' | 'exempt' | 'payable';
  dutyRate: number | null;
  dutyAmount: number | null;
  vatTreatment: 'unknown' | 'not_subject' | 'exempt' | 'payable';
  vatRate: number | null;
  vatAmount: number | null;
  taxBasis: string;
  restrictionStatus: 'unknown' | 'not_required' | 'required';
  restrictionReferences: Array<Record<string, unknown>>;
  preferenceClaimStatus: 'no_claim' | 'claimed';
  preferenceReferences: Array<Record<string, unknown>>;
  guaranteeRequirementStatus: 'unknown' | 'not_required' | 'required';
  guaranteeReferences: Array<Record<string, unknown>>;
  supportingDocuments: Array<Record<string, unknown>>;
  targetSystemSchemaId: string;
  targetSystemSchemaVersion: string;
  declarationNotes: string;
  metadata: Record<string, unknown>;
}

export interface EuImportLineDetail {
  id?: string;
  shipmentId?: string;
  exportLineId: string;
  taricCode: string;
  taricSource: string;
  taricVersion: string;
  taricEffectiveDate: string | null;
  taricConfirmed: boolean;
  taricConfirmedBy?: string | null;
  taricConfirmedAt?: string | null;
  supplementaryUnitCode: string;
  additionalCodes: string[];
  nationalAdditionalCodes: string[];
  preferenceCode: string;
  requestedProcedureCode: string;
  previousProcedureCode: string;
  metadata: Record<string, unknown>;
}

export type EuImportEventType =
  | 'declarant_received' | 'declarant_validated' | 'declarant_rejected'
  | 'authority_submitted' | 'authority_accepted' | 'authority_rejected'
  | 'authority_released' | 'authority_cancelled'
  | 'amendment_requested' | 'amendment_submitted';

export interface EuImportExternalEvent extends Omit<VnCustomsExternalEvent, 'eventType' | 'sourceType'> {
  eventType: EuImportEventType;
  sourceType: 'declarant' | 'authority';
}

export interface EuImportReconciliation {
  status: 'passed' | 'failed';
  rulesetVersion: string;
  sourceSnapshotSha256: string;
  schema: { id: string; version: string; regulatoryBasisVersion: string; eucdmVersion?: string };
  checks: CarrierReconciliationCheck[];
  summary: {
    memberStateCode: string;
    goodsLineCount: number;
    mappedLineCount: number;
    packageCount: number;
    netWeightKg: number;
    grossWeightKg: number;
    customsValue: number | null;
    carrierDocumentId: string | null;
  };
}

export interface ShipmentPackage {
  id: string;
  packageNumber: string;
  packageType: string;
  marksAndNumbers: string;
  containerId: string | null;
  containerNumber: string;
  sealNumber: string;
  parentPackageId: string | null;
  parentPackageNumber: string;
  sequenceNo: number | null;
  quantity: number;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightMeasurementBasis: 'per_package' | 'group_total';
  dimensionMeasurementBasis: 'per_package' | 'group_total';
  contents: unknown[];
}

export interface ShipmentContainer {
  id: string;
  containerNumber: string;
  sealNumber: string;
  equipmentType: string;
  marksAndNumbers: string;
  tareWeightKg: number | null;
  maxGrossWeightKg: number | null;
  metadata: Record<string, unknown>;
}

export interface ShipmentExportDocument {
  id: string;
  shipmentId: string;
  reportId: string;
  type: ExportDocumentType;
  outputFormat: ExportOutputFormat | null;
  version: number;
  status: 'draft' | 'blocked' | 'ready' | 'issued' | 'superseded' | 'failed';
  reportStatus: string | null;
  downloadUrl: string | null;
  filename: string | null;
  fileSha256: string | null;
  requiredReviewerRole: 'export_operator' | 'warehouse_reviewer' | 'customs_declaration_reviewer' | 'eu_import_declaration_reviewer' | null;
  latestReview: ExportDocumentReview | null;
  readyToIssue: boolean;
  issuedAt: string | null;
}

export interface ExportDocumentReview {
  id: string;
  documentId: string;
  reviewerRole: 'export_operator' | 'warehouse_reviewer' | 'customs_declaration_reviewer' | 'eu_import_declaration_reviewer';
  decision: 'approved' | 'rejected' | 'changes_requested' | 'stale';
  originalDecision?: 'approved' | 'rejected' | 'changes_requested';
  notes: string;
  reviewerName: string;
  reviewerEmail: string | null;
  reviewedAt: string;
  stale?: boolean;
}

export interface ShipmentExportBundle {
  shipment: { id: string; referenceNumber: string; status: string; originCountry: string; destinationCountry: string };
  profile: ShipmentExportProfile | null;
  lines: ShipmentExportLine[];
  containers: ShipmentContainer[];
  packages: ShipmentPackage[];
  carrierDocuments: CarrierEvidenceDocument[];
  vnCustomsProfile: VnCustomsProfile | null;
  vnCustomsEvents: VnCustomsExternalEvent[];
  vnCustomsEvidence: Array<{
    id: string; type: string; name: string; status: string; checksumSha256: string | null;
    fileSizeBytes: number; validFrom: string | null; validTo: string | null;
    mimeType: string | null; uploadedAt: string; approvedAt: string | null; approvedBy: string | null;
  }>;
  euImportProfile: EuImportProfile | null;
  euImportLineDetails: EuImportLineDetail[];
  euImportEvents: EuImportExternalEvent[];
  euImportEvidence: Array<{
    id: string; type: string; name: string; status: string; checksumSha256: string | null;
    fileSizeBytes: number; validFrom: string | null; validTo: string | null;
    mimeType: string | null; uploadedAt: string; approvedAt: string | null; approvedBy: string | null;
  }>;
  documents: ShipmentExportDocument[];
}

export interface ExportReadiness {
  shipmentId: string;
  rulesetVersion: string;
  status: 'blocked' | 'internal_review' | 'ready_to_issue';
  documentCompleteness: number;
  documents: Array<{ type: ExportDocumentType; applicable: boolean; status: 'blocked' | 'ready' | 'not_applicable'; missingFields: string[]; messages: string[] }>;
  cbam: { applicable: boolean; status: string; matchedHsCodes: string[]; rulesetVersion: string };
}

export const emptyShipmentExportProfile = (): ShipmentExportProfile => ({
  targetMarket: 'EU', invoiceNumber: '', invoiceDate: null, invoiceIssuePlace: '',
  packingListNumber: '', packingListDate: null, poContractId: '',
  incotermCode: '', incotermLocation: '', incotermVersion: 'Incoterms 2020',
  currency: '', paymentTerms: '', exporter: {}, importer: {}, consignee: {}, notifyParty: {},
  exporterTaxId: '', importerEori: '', importerVatId: '', portOfLoading: '', portOfDischarge: '', placeOfDelivery: '',
  vesselName: '', voyageNumber: '', carrierName: '', billOfLadingNo: '', containerNo: '', sealNo: '',
  customsDeclarationNo: '', freightAmount: null, insuranceAmount: null,
  discountAmount: null, surchargeAmount: null, customsValueAmount: null, customsValueBasis: '', transportMode: '',
  preferentialOriginClaim: false, metadata: {}
});

export const emptyVnCustomsProfile = (): VnCustomsProfile => ({
  schemaId: 'weavecarbon.vn-export-broker-handoff', schemaVersion: '1.0.0',
  rulesetVersion: 'R04-VN-CUSTOMS-HANDOFF-2026.09.1',
  regulatoryBasisVersion: 'TT38/2015+TT39/2018+TT121/2025@2026-02-01',
  filingPurpose: 'broker_handoff', declarant: { role: 'exporter' }, customsBroker: {},
  customsOfficeCode: '', declarationTypeCode: '', cargoClassificationCode: '',
  transportMethodCode: '', exitCustomsOfficeCode: '', loadingLocationCode: '',
  destinationCountryCode: '', invoiceClassificationCode: '', invoicePaymentMethodCode: '',
  exchangeRate: null, permitRequirementStatus: 'unknown', permitReferences: [],
  inspectionRequirementStatus: 'unknown', inspectionReferences: [], taxTreatment: 'unknown',
  exportDutyRate: null, exportDutyAmount: null, taxBasis: '',
  supportingDocuments: [
    { type: 'commercial_invoice', reference: '' },
    { type: 'packing_list', reference: '' }
  ],
  brokerTargetSchemaId: '', brokerTargetSchemaVersion: '', declarationNotes: '', metadata: {}
});

export const emptyEuImportProfile = (): EuImportProfile => ({
  schemaId: 'weavecarbon.eu-import-declarant-handoff', schemaVersion: '1.0.0',
  rulesetVersion: 'R05-EU-IMPORT-HANDOFF-2026.09.1',
  regulatoryBasisVersion: 'UCC-DA-2015/2446-ANNEX-B+UCC-IA-2015/2447-ANNEX-B@EUCDM-7.0.11',
  filingPurpose: 'declarant_handoff', memberStateCode: '', importer: {}, declarant: {}, representative: {},
  representationType: 'none', customsOfficeCode: '', declarationDatasetCode: '',
  additionalDeclarationType: '', requestedProcedureCode: '', previousProcedureCode: '',
  modeOfTransportAtBorder: '', inlandModeOfTransport: '', borderTransportIdentity: '',
  placeOfGoodsCode: '', deliveryTermsLocation: '', valuationMethodCode: '', exchangeRate: null,
  customsValueCurrency: '', customsValueAmount: null, dutyTreatment: 'unknown', dutyRate: null,
  dutyAmount: null, vatTreatment: 'unknown', vatRate: null, vatAmount: null, taxBasis: '',
  restrictionStatus: 'unknown', restrictionReferences: [], preferenceClaimStatus: 'no_claim',
  preferenceReferences: [], guaranteeRequirementStatus: 'unknown', guaranteeReferences: [],
  supportingDocuments: [
    { type: 'commercial_invoice', reference: '' }, { type: 'packing_list', reference: '' },
    { type: 'carrier_document', reference: '' }
  ],
  targetSystemSchemaId: '', targetSystemSchemaVersion: '', declarationNotes: '', metadata: {}
});

const base = (shipmentId: string) => `/export/shipments/${encodeURIComponent(shipmentId)}`;

export const fetchShipmentExportProfile = (shipmentId: string) =>
  api.get<ShipmentExportBundle>(`${base(shipmentId)}/profile`);
export const saveShipmentExportProfile = (shipmentId: string, profile: ShipmentExportProfile) =>
  api.put<ShipmentExportProfile>(`${base(shipmentId)}/profile`, profile);
export const syncShipmentExportLines = (shipmentId: string) =>
  api.post<ShipmentExportLine[]>(`${base(shipmentId)}/lines/sync`, {});
export const updateShipmentExportLine = (shipmentId: string, lineId: string, payload: Partial<ShipmentExportLine>) =>
  api.patch<ShipmentExportLine>(`${base(shipmentId)}/lines/${encodeURIComponent(lineId)}`, payload);
export const fetchShipmentExportReadiness = (shipmentId: string) =>
  api.get<ExportReadiness>(`${base(shipmentId)}/readiness`);
export const saveVnCustomsProfile = (shipmentId: string, profile: VnCustomsProfile) =>
  api.put<VnCustomsProfile>(`${base(shipmentId)}/vn-customs/profile`, profile);
export const fetchVnCustomsReconciliation = (shipmentId: string) =>
  api.get<VnCustomsReconciliation>(`${base(shipmentId)}/vn-customs/reconciliation`);
export const fetchVnCustomsEvents = (shipmentId: string) =>
  api.get<VnCustomsExternalEvent[]>(`${base(shipmentId)}/vn-customs/events`);
export const recordVnCustomsEvent = (
  shipmentId: string,
  payload: {
    exportDocumentId: string; eventType: VnCustomsEventType; externalReference: string;
    evidenceDocumentId: string; actorName: string; actorIdentifier?: string;
    messageCode?: string; messageText?: string; occurredAt: string;
  }
) => api.post<VnCustomsExternalEvent>(`${base(shipmentId)}/vn-customs/events`, payload);
export const saveEuImportProfile = (shipmentId: string, profile: EuImportProfile) => {
  const input = { ...profile } as Record<string, unknown>;
  [
    'id', 'shipmentId', 'updatedAt', 'schemaId', 'schemaVersion',
    'rulesetVersion', 'regulatoryBasisVersion', 'filingPurpose'
  ].forEach((key) => delete input[key]);
  return api.put<EuImportProfile>(`${base(shipmentId)}/eu-import/profile`, input);
};
export const saveEuImportLineDetail = (shipmentId: string, lineId: string, detail: Partial<EuImportLineDetail>) =>
  api.put<EuImportLineDetail>(`${base(shipmentId)}/eu-import/lines/${encodeURIComponent(lineId)}`, detail);
export const fetchEuImportReconciliation = (shipmentId: string) =>
  api.get<EuImportReconciliation>(`${base(shipmentId)}/eu-import/reconciliation`);
export const fetchEuImportEvents = (shipmentId: string) =>
  api.get<EuImportExternalEvent[]>(`${base(shipmentId)}/eu-import/events`);
export const recordEuImportEvent = (
  shipmentId: string,
  payload: {
    exportDocumentId: string; eventType: EuImportEventType; externalReference: string;
    evidenceDocumentId: string; actorName: string; actorIdentifier?: string;
    messageCode?: string; messageText?: string; occurredAt: string;
  }
) => api.post<EuImportExternalEvent>(`${base(shipmentId)}/eu-import/events`, payload);
export const createShipmentContainer = (shipmentId: string, payload: Partial<ShipmentContainer>) =>
  api.post<ShipmentContainer>(`${base(shipmentId)}/containers`, payload);
export const updateShipmentContainer = (shipmentId: string, containerId: string, payload: Partial<ShipmentContainer>) =>
  api.patch<ShipmentContainer>(`${base(shipmentId)}/containers/${encodeURIComponent(containerId)}`, payload);
export const createShipmentPackage = (shipmentId: string, payload: Partial<ShipmentPackage>) =>
  api.post<ShipmentPackage>(`${base(shipmentId)}/packages`, payload);
export const updateShipmentPackage = (shipmentId: string, packageId: string, payload: Partial<ShipmentPackage>) =>
  api.patch<ShipmentPackage>(`${base(shipmentId)}/packages/${encodeURIComponent(packageId)}`, payload);
export const generateShipmentExportDocument = (shipmentId: string, type: ExportDocumentType, outputFormat?: ExportOutputFormat) =>
  api.post<ShipmentExportDocument>(`${base(shipmentId)}/documents/${type}/generate`, outputFormat ? { outputFormat } : {});
export const issueShipmentExportDocument = (shipmentId: string, documentId: string) =>
  api.post<ShipmentExportDocument>(`${base(shipmentId)}/documents/${encodeURIComponent(documentId)}/issue`, {});
export const reviewShipmentExportDocument = (
  shipmentId: string,
  documentId: string,
  payload: { reviewerRole: 'export_operator' | 'warehouse_reviewer' | 'customs_declaration_reviewer' | 'eu_import_declaration_reviewer'; decision: 'approved' | 'rejected' | 'changes_requested'; notes?: string }
) => api.post<ExportDocumentReview>(`${base(shipmentId)}/documents/${encodeURIComponent(documentId)}/reviews`, payload);

export const uploadCarrierDocument = async (shipmentId: string, file: File, kind: CarrierDocumentType = 'bill_of_lading') => {
  const body = new FormData();
  body.append('file', file);
  body.append('shipmentId', shipmentId);
  body.append('kind', kind);
  body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string }; success?: boolean };
  const id = payload.data?.id;
  if (!id) throw new Error('Carrier document upload did not return an evidence id.');
  return { ...payload.data, id };
};

export const createCarrierDocumentMetadata = (shipmentId: string, payload: CarrierDocumentMetadata) =>
  api.post<CarrierEvidenceDocument>(`${base(shipmentId)}/carrier-documents`, payload);
export const updateCarrierDocumentMetadata = (shipmentId: string, carrierDocumentId: string, payload: Partial<CarrierDocumentMetadata>) =>
  api.patch<CarrierEvidenceDocument>(`${base(shipmentId)}/carrier-documents/${encodeURIComponent(carrierDocumentId)}`, payload);
export const deleteCarrierDocumentMetadata = (shipmentId: string, carrierDocumentId: string) =>
  api.delete<{ deleted: true }>(`${base(shipmentId)}/carrier-documents/${encodeURIComponent(carrierDocumentId)}`);
export const fetchCarrierDocumentReconciliation = (shipmentId: string, carrierDocumentId: string) =>
  api.get<CarrierDocumentReconciliation>(`${base(shipmentId)}/carrier-documents/${encodeURIComponent(carrierDocumentId)}/reconciliation`);
export const confirmCarrierDocument = (
  shipmentId: string,
  carrierDocumentId: string,
  payload: { metadataConfirmed: true; confirmationNote: string }
) => api.post<CarrierEvidenceDocument>(`${base(shipmentId)}/carrier-documents/${encodeURIComponent(carrierDocumentId)}/confirm`, payload);

export const uploadVnCustomsEvidence = async (
  shipmentId: string,
  file: File,
  kind: 'customs_broker_response' | 'customs_authority_response' | 'customs_declaration'
) => {
  const body = new FormData();
  body.append('file', file);
  body.append('shipmentId', shipmentId);
  body.append('kind', kind);
  body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string }; success?: boolean };
  if (!payload.data?.id) throw new Error('Customs response upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockVnCustomsEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadEuImportEvidence = async (
  shipmentId: string,
  file: File,
  kind: 'eu_declarant_response' | 'eu_customs_authority_response' | 'eu_import_declaration'
) => {
  const body = new FormData();
  body.append('file', file);
  body.append('shipmentId', shipmentId);
  body.append('kind', kind);
  body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('EU customs evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockEuImportEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const downloadReportFile = async (reportId: string, fallbackName: string) => {
  const response = await api.raw(`/reports/${encodeURIComponent(reportId)}/download`);
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = match?.[1] || fallbackName;
  link.click();
  URL.revokeObjectURL(url);
};
