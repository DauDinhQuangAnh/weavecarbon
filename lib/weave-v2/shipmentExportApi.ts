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

export interface Ics2Party extends ExportParty {
  eori?: string;
  contactName?: string;
  phone?: string;
  email?: string;
}

export interface Ics2HouseConsignment {
  id: string;
  transportDocumentType: string;
  transportDocumentNumber: string;
  ucr: string;
  consignor: Ics2Party;
  consignee: Ics2Party;
  buyer: Ics2Party;
  seller: Ics2Party;
  destinationCountry: string;
  placeOfDelivery: string;
  grossMassKg: number | null;
  packageCount: number | null;
  goodsLineIds: string[];
  additionalSupplyChainActors: Ics2Party[];
  metadata: Record<string, unknown>;
}

export interface Ics2Profile {
  id?: string;
  shipmentId?: string;
  updatedAt?: string;
  schemaId: 'weavecarbon.ics2-filing-handoff';
  schemaVersion: '1.0.0';
  rulesetVersion: string;
  regulatoryBasisVersion: string;
  filingPurpose: 'filer_handoff';
  ics2Release: 'R3';
  htiAgreementRef: 'EU-ICS2-TI-V2.0';
  transportMode: 'sea' | 'inland_waterway' | 'air' | 'road' | 'rail';
  messageDatasetCode: string;
  filingRole: 'carrier' | 'house_level_filer' | 'express_carrier' | 'postal_operator' | 'representative';
  filingArrangement: 'single' | 'multiple';
  localReferenceNumber: string;
  sender: Ics2Party;
  declarant: Ics2Party;
  representative: Ics2Party;
  customsOfficeFirstEntry: string;
  firstEntryCountry: string;
  estimatedArrivalAt: string;
  itineraryCountries: string[];
  conveyanceReference: string;
  containerIndicator: boolean;
  masterTransportDocument: { type: string; number: string };
  activeBorderTransportMeans: { identificationType: string; identificationNumber: string; nationality: string };
  seals: string[];
  paymentMethodCode: string;
  targetSystemSchemaId: string;
  targetSystemSchemaVersion: string;
  technicalPackageId: string;
  technicalPackageVersion: string;
  messageNamespace: string;
  houseConsignments: Ics2HouseConsignment[];
  filingNotes: string;
  metadata: Record<string, unknown>;
}

export type Ics2EventType =
  | 'filer_received' | 'filer_validated' | 'filer_rejected'
  | 'authority_registered' | 'authority_rejected' | 'risk_referral' | 'do_not_load'
  | 'assessment_complete' | 'amendment_requested' | 'amendment_registered'
  | 'invalidation_requested' | 'invalidated';

export interface Ics2ExternalEvent extends Omit<VnCustomsExternalEvent, 'eventType' | 'sourceType'> {
  eventType: Ics2EventType;
  sourceType: 'filer' | 'authority';
}

export interface Ics2Reconciliation {
  status: 'ready' | 'blocked';
  rulesetVersion: string;
  sourceSnapshotSha256: string;
  schema: { id: string; version: string; regulatoryBasisVersion: string; ics2Release: string };
  checks: CarrierReconciliationCheck[];
  blockingCodes: string[];
}

export type OriginRuleCode =
  | 'CH61_CUT_SEWN_KNITTING_AND_MAKING_UP'
  | 'CH61_KNITTED_TO_SHAPE_SPINNING_OR_EXTRUSION_AND_KNITTING'
  | 'CH62_GENERAL_WEAVING_AND_MAKING_UP'
  | 'CH64_GENERAL_EXCLUDES_6406_UPPER_ASSEMBLY'
  | 'SPECIALIST_RULE_REVIEW';

export interface OriginMaterial {
  id: string; reference: string; description: string; hsCode: string; supplierName: string;
  originCountry: string; originStatus: 'originating' | 'non_originating' | 'cumulated' | 'unknown';
  cumulationBasis: 'none' | 'eu_bilateral' | 'asean_article_3_2' | 'korea_fabric_article_3_7';
  value: number | null; weightKg: number | null; evidenceDocumentId: string;
  isUpperAssemblyAffixedToSole: boolean | null; notes: string;
}

export interface OriginLineAssessment {
  exportLineId: string; ruleCode: OriginRuleCode | ''; ruleSourcePage: string;
  specialistRuleText: string; productionProcesses: string[]; exWorksPrice: number | null;
  nonOriginatingMaterialValue: number | null; materials: OriginMaterial[]; notes: string;
}

export interface OriginProfile {
  id?: string; shipmentId?: string; updatedAt?: string;
  schemaId: 'weavecarbon.evfta-origin-support-handoff'; schemaVersion: '1.0.0';
  rulesetVersion: string; regulatoryBasisVersion: string; handoffPurpose: 'origin_specialist_review';
  claimType: 'certificate_application' | 'origin_declaration_draft'; invoiceTotalEur: number | null;
  exporterAuthorizationType: 'none' | 'approved' | 'registered'; exporterAuthorizationReference: string;
  territorialityConfirmed: boolean; nonAlterationConfirmed: boolean;
  insufficientProcessingExcluded: boolean; lineAssessments: OriginLineAssessment[];
  notes: string; metadata: Record<string, unknown>;
}

export interface OriginReconciliation {
  status: 'not_applicable' | 'blocked' | 'ready_for_specialist_review';
  applicability: 'PREFERENCE_NOT_CLAIMED' | 'PREFERENCE_CLAIMED';
  sourceSnapshotSha256: string; schema: { id: string; version: string; rulesetVersion: string };
  checks: CarrierReconciliationCheck[]; blockingCodes: string[];
}

export interface ComplianceMaterialFact {
  reference: string; description: string; hsCode: string; originCountry: string;
  percentageByWeight: number | null; animalOrigin: boolean | null; substancesScreened: boolean | null;
}

export interface ComplianceApplicabilityInput {
  assessmentDate: string; productCategory: string; intendedUse: string; consumerGroup: string;
  importerRole: string; salesChannels: string[]; consumerProduct: boolean;
  placedOnEuMarket: boolean; textileFibrePercent: number | null;
  reachContext: {
    directAndProlongedSkinOrOralContact: boolean | null;
    washableInWaterDuringNormalLifecycle: boolean | null;
    secondHand: boolean | null; exclusivelyRecycledWithoutNpe: boolean | null;
    leatherPartsContactSkin: boolean | null;
  };
  packagingContext: {
    present: boolean | null; types: string[]; materials: string[]; reusable: boolean | null;
    supplierIdentified: boolean | null; customerIdentified: boolean | null;
    directDistanceSaleToEuEndUser: boolean | null; producerRoleAssessed: boolean | null;
  };
  materialFacts: ComplianceMaterialFact[]; notes: string;
}

export interface ComplianceApplicabilityMatch {
  code: string;
  decision: 'not_triggered' | 'requirements_identified' | 'specialist_review_required';
  risk: string; matchPrecision: string; reason: string; sourceId: string | null;
  matchedProductCodes: string[]; requiredEvidenceTypes: string[];
}

export interface ComplianceApplicabilityReview {
  id: string; evaluationId: string; reviewerId: string; reviewerRole: 'compliance_specialist';
  reviewerName: string | null; reviewerEmail: string | null;
  decision: 'confirmed_for_internal_planning' | 'needs_information' | 'rejected';
  notes: string; inputSha256: string; resultSha256: string;
  evidenceSnapshot: Array<{ id: string; type?: string; name?: string; checksumSha256?: string }>;
  createdAt: string;
}

export interface ComplianceApplicabilityEvaluation {
  id: string; shipmentId: string; rulesetId: string; rulesetVersion: string;
  rulesetCoverage: 'limited' | 'complete'; sourceManifestSha256: string;
  assessmentDate: string; input: Record<string, unknown>; inputSha256: string;
  result: {
    status: 'not_applicable' | 'requirements_identified' | 'specialist_review_required';
    specialistReviewRequired: boolean; missingInputs: string[]; matches: ComplianceApplicabilityMatch[];
    classifications?: Array<{
      exportLineId: string; sku: string; operatorDescription: string;
      declaredCnCode: string | null; declaredTaricCode: string | null;
      datasetId: string; datasetVersion: string; datasetDescription: string | null;
      category: string | null; legalRouteCodes: string[]; matchStatus: string; matchPrecision: string;
      operatorDescriptionReviewRequired: boolean; consultationUrl: string | null;
    }>;
    restrictionScreenings?: Array<{
      ruleId: string; entryNumber: string; substanceGroup: string;
      threshold: { operator: string; value: number; unit: string };
      scope: string; scopeStatus: string; reason: string; missingScopeFacts: string[];
      matchedProductCodes: string[]; sourceId: string; datasetId: string; datasetVersion: string;
      requiredEvidenceTypes: string[];
    }>;
    requiredEvidenceTypes: string[];
    datasets?: Array<{ id: string; version: string; coverageStatus: string; sha256: string }>;
    sources: Array<{ id: string; title: string; url: string; version: string }>;
    disclaimer: string; resultSha256: string;
  };
  resultSha256: string;
  status: 'not_applicable' | 'requirements_identified' | 'specialist_review_required';
  createdBy: string; createdAt: string; latestReview: ComplianceApplicabilityReview | null;
}

export interface TextileFibreLabelInput {
  specificationReference: string; assessmentDate: string; productReference: string; productCategory: string;
  specialProductCategory: 'standard' | 'annex_iv' | 'annex_v' | 'annex_vi' | 'unknown';
  textileFibrePercent: number; marketCodes: string[];
  components: Array<{
    componentReference: string; componentName: string; weightPercent: number; mainLining: boolean;
    fibres: Array<{ fibreCode: string; percentage: number }>;
  }>;
  animalOriginPresence: 'present' | 'absent' | 'unknown';
  languageLabels: Array<{
    marketCode: string; languageCode: string; labelText: string;
    animalOriginStatementIncluded: boolean; operatorApproved: boolean;
  }>;
  economicOperator: { role: string; name: string; address: string };
  placement: {
    method: string; durable: boolean; easilyLegible: boolean; visible: boolean;
    accessible: boolean; securelyAttached: boolean; onlineBeforePurchase: boolean;
  };
  evidenceDocumentIds: string[]; notes: string;
}

export interface TextileFibreLabelReview {
  id: string; specificationId: string; reviewerId: string; reviewerName: string; reviewerEmail: string | null;
  reviewerRole: 'textile_label_reviewer';
  decision: 'approved_for_internal_artwork' | 'needs_information' | 'rejected';
  notes: string; inputSha256: string; resultSha256: string;
  evidenceSnapshot: Array<{ id: string; type: string; name: string; status: string; checksumSha256: string; fileSizeBytes: number }>;
  createdAt: string;
}

export interface TextileFibreLabelSpecification {
  id: string; shipmentId: string; specificationReference: string; revision: number;
  rulesetId: string; rulesetVersion: string; rulesetCoverage: 'limited' | 'complete';
  sourceManifestSha256: string; assessmentDate: string; input: TextileFibreLabelInput; inputSha256: string;
  result: {
    automatedStatus: 'needs_information' | 'specialist_review_required' | 'ready_for_label_review';
    euMarket: boolean; missingInputs: string[]; englishPreview: string;
    findings: Array<{ code: string; severity: 'blocker' | 'specialist' | 'warning' | 'info'; message: string; sourceArticle: string | null; path: string | null }>;
    sources: Array<{ id: string; title: string; url: string; version: string }>;
    disclaimer: string; resultSha256: string;
  };
  resultSha256: string; evidenceSnapshot: TextileFibreLabelReview['evidenceSnapshot'];
  automatedStatus: TextileFibreLabelSpecification['result']['automatedStatus'];
  artworkStatus: 'needs_information' | 'specialist_review_required' | 'label_review_required'
    | 'approved_for_internal_artwork' | 'evidence_review_required' | 'rejected' | 'superseded';
  staleEvidenceIds: string[]; createdBy: string; createdAt: string; latestReview: TextileFibreLabelReview | null;
}

export interface GpsrEconomicOperator {
  name: string; tradeName?: string; postalAddress: string; electronicAddress: string;
  contactPoint?: string; euEstablished: boolean;
}

export interface GpsrTechnicalFileInput {
  fileReference: string; assessmentDate: string; firstPlacedOnMarketDate: string;
  consumerProduct: boolean; placedOnEuMarket: boolean; marketCodes: string[];
  harmonisationCoverage: 'none' | 'partial' | 'full' | 'unknown'; applicableSectorRules: string[];
  product: {
    brand: string; name: string; model: string; type: string; batchNumber: string; serialNumber: string;
    otherIdentifier: string; description: string; essentialCharacteristics: string; composition: string;
    packagingDescription: string; productImageEvidenceId: string; packagingImageEvidenceId: string;
  };
  intendedUse: string; foreseeableMisuse: string; vulnerableGroups: string[];
  operators: { manufacturer: GpsrEconomicOperator; importer: GpsrEconomicOperator; responsiblePerson: GpsrEconomicOperator };
  risks: Array<{
    hazardId: string; hazardCategory: string; hazardDescription: string; affectedGroups: string[];
    foreseeableScenario: string; likelihood: number; severity: number; mitigation: string;
    residualLikelihood: number; residualSeverity: number; verificationEvidenceIds: string[];
  }>;
  standards: Array<{ reference: string; title: string; version: string; applicationExtent: 'full' | 'partial'; appliedParts: string }>;
  warnings: Array<{ marketCode: string; languageCode: string; text: string; location: 'product' | 'packaging' | 'accompanying_document' | 'online_offer'; operatorApproved: boolean }>;
  onlineOffer: { enabled: boolean; manufacturerDisplayed: boolean; responsiblePersonDisplayed: boolean;
    productImageDisplayed: boolean; identifiersDisplayed: boolean; warningsDisplayed: boolean; offerUrl: string };
  seriesProductionProcedure: string; complaintChannel: string; postMarketPlan: string;
  retentionUntil: string; evidenceDocumentIds: string[]; notes: string;
}

export interface GpsrTechnicalFileReview {
  id: string; technicalFileId: string; reviewerId: string; reviewerName: string; reviewerEmail: string | null;
  reviewerRole: 'product_safety_reviewer'; decision: 'approved_for_internal_release' | 'needs_information' | 'rejected';
  notes: string; inputSha256: string; resultSha256: string;
  evidenceSnapshot: Array<{ id: string; type: string; name: string; status: string; checksumSha256: string; fileSizeBytes: number }>;
  createdAt: string;
}

export interface GpsrTechnicalFile {
  id: string; shipmentId: string; fileReference: string; revision: number; rulesetId: string; rulesetVersion: string;
  rulesetCoverage: 'limited' | 'complete'; sourceManifestSha256: string; assessmentDate: string;
  firstPlacedOnMarketDate: string; retentionUntil: string; input: GpsrTechnicalFileInput; inputSha256: string;
  result: { automatedStatus: 'needs_information' | 'specialist_review_required' | 'ready_for_safety_review';
    minimumRetentionUntil: string; missingInputs: string[];
    findings: Array<{ code: string; severity: 'blocker' | 'specialist' | 'warning' | 'info'; message: string; sourceArticle: string | null; path: string | null }>;
    sources: Array<{ id: string; title: string; url: string; version: string; appliesFrom: string }>;
    disclaimer: string; resultSha256: string };
  resultSha256: string; evidenceSnapshot: GpsrTechnicalFileReview['evidenceSnapshot'];
  automatedStatus: GpsrTechnicalFile['result']['automatedStatus'];
  safetyFileStatus: 'needs_information' | 'specialist_review_required' | 'safety_review_required'
    | 'approved_for_internal_release' | 'evidence_review_required' | 'rejected' | 'superseded';
  staleEvidenceIds: string[]; createdBy: string; createdAt: string; latestReview: GpsrTechnicalFileReview | null;
}

export interface GpsrPostMarketEvent {
  id: string; shipmentId: string; technicalFileId: string;
  eventType: 'complaint' | 'safety_incident' | 'corrective_action' | 'recall' | 'safety_business_gateway_notification' | 'authority_request' | 'consumer_notice';
  eventReference: string; occurredAt: string; summary: string; severity: 'information' | 'minor' | 'serious' | 'death' | 'unknown';
  externalReference: string | null; evidenceDocumentId: string | null; evidenceSha256: string | null;
  evidenceFileSizeBytes: number | null; recorderId: string; recorderName: string; recorderEmail: string | null;
  metadata: Record<string, unknown>; createdAt: string; safetyBusinessGatewayNotificationRequired: boolean;
}

export interface ReachRestrictionAssessmentInput {
  entryNumber: string; scopeDecision: 'applies' | 'not_applies' | 'unknown'; scopeRationale: string;
  legalLimit: number | null; limitUnit: 'percent_w_w' | 'mg_kg' | 'mg_kg_material' | 'mg_kg_extracted' | '';
  measuredValue: number | null; prohibitedWhen: 'at_or_above_limit' | 'above_limit' | ''; testMethod: string;
  exemptionClaimed: boolean; exemptionRationale: string;
  evidenceDocumentIds: string[];
}
export interface ReachSubstanceInput {
  substanceName: string; casNumber: string; ecNumber: string; echaId: string;
  candidateListStatus: 'included' | 'not_included' | 'unknown'; candidateInclusionDate: string | null;
  concentrationPercentWw: number; annualTonnage: number | null; location: string;
  evidenceBasis: 'supplier_declaration' | 'sds' | 'laboratory_test' | 'calculation' | 'unknown';
  detectionLimit: number | null; detectionLimitUnit: string;
  safeUseInstructions: Array<{ marketCode: string; languageCode: string; text: string; operatorApproved: boolean }>;
  article7Exemption: 'none' | 'registered_for_use' | 'exposure_excluded' | '';
  article7ExemptionRationale: string; evidenceDocumentIds: string[];
  restrictionAssessments: ReachRestrictionAssessmentInput[];
}
export interface ReachSvhcDossierInput {
  dossierReference: string; assessmentDate: string; productReference: string; productName: string;
  articleCategory: string; consumerArticle: boolean; placedOnEuMarket: boolean; marketCodes: string[];
  euActorRole: string; articleLevelAssessmentConfirmed: boolean; candidateListSnapshotDate: string;
  candidateListEntryCount: number; reachConsolidatedDate: string;
  components: Array<{ componentReference: string; componentName: string; articleReference: string;
    homogeneousMaterialReference: string; materialName: string; materialLocation: string; substances: ReachSubstanceInput[] }>;
  supplierDeclarationEvidenceIds: string[]; notes: string;
}
export interface ReachSvhcReview {
  id: string; dossierId: string; reviewerId: string; reviewerName: string; reviewerEmail: string | null;
  reviewerRole: 'chemical_compliance_reviewer'; decision: 'approved_for_internal_release' | 'needs_information' | 'rejected';
  notes: string; inputSha256: string; resultSha256: string;
  evidenceSnapshot: Array<{ id: string; type: string; name: string; status: string; checksumSha256: string; fileSizeBytes: number }>;
  createdAt: string;
}
export interface ReachSvhcDossier {
  id: string; shipmentId: string; dossierReference: string; revision: number; rulesetId: string; rulesetVersion: string;
  rulesetCoverage: 'limited' | 'complete'; sourceManifestSha256: string; assessmentDate: string;
  candidateListSnapshotDate: string; reachConsolidatedDate: string; input: ReachSvhcDossierInput; inputSha256: string;
  result: { automatedStatus: 'needs_information' | 'specialist_review_required' | 'ready_for_chemical_review';
    missingInputs: string[]; findings: Array<{ code: string; severity: 'blocker' | 'specialist' | 'warning' | 'info'; message: string; sourceArticle: string | null; path: string | null }>;
    obligations: Array<{ code: string; componentReference: string; substanceName: string; responseDays?: number; annualTonnage?: number }>;
    sources: Array<{ id: string; title: string; url: string; version: string }>; disclaimer: string; resultSha256: string };
  resultSha256: string; evidenceSnapshot: ReachSvhcReview['evidenceSnapshot']; automatedStatus: ReachSvhcDossier['result']['automatedStatus'];
  releaseStatus: 'needs_information' | 'specialist_review_required' | 'chemical_review_required' | 'approved_for_internal_release'
    | 'evidence_review_required' | 'rejected' | 'superseded'; staleEvidenceIds: string[];
  createdBy: string; createdAt: string; latestReview: ReachSvhcReview | null;
}
export interface ReachObligationEvent {
  id: string; shipmentId: string; dossierId: string;
  eventType: 'supply_chain_communication' | 'consumer_request_received' | 'consumer_response_sent' | 'article7_notification'
    | 'scip_notification' | 'authority_request' | 'authority_response' | 'corrective_action';
  eventReference: string; occurredAt: string; responseDueAt: string | null; responseOverdue: boolean;
  summary: string; externalReference: string | null; evidenceDocumentId: string | null; evidenceSha256: string | null;
  evidenceFileSizeBytes: number | null; recorderId: string; recorderName: string; recorderEmail: string | null;
  metadata: Record<string, unknown>; createdAt: string;
}

export interface PcfCalculationSnapshot {
  id: string; productId: string; productReference: string; productName: string; version: number; latestVersion: number;
  calculatedAt: string; finalizedAt: string; canonicalInputHash: string; engineVersion: string;
  methodologyVersion: string; factorRegistryVersion: string; gwpBasis: string; reportedTotalKgCO2e: number | null;
  boundary: { includedStages?: string[]; excludedStages?: string[]; partialCfp?: boolean } | null;
  quality: Record<string, unknown> | null; uncertainty: Record<string, unknown> | null;
}
export interface PcfStudyInput {
  studyReference: string; studyDate: string; calculationSnapshotId: string; productReference: string; productName: string;
  reportingPeriodStart: string; reportingPeriodEnd: string; intendedApplication: string; intendedAudience: string;
  comparativeAssertion: boolean; functionalUnit: { quantity: number; unit: string; description: string };
  referenceFlow: { amount: number; unit: string; basis: string }; boundaryType: string; includedStages: string[];
  processMap: Array<{ processReference: string; processName: string; stage: string; included: boolean;
    dataSource: string; evidenceDocumentIds: string[] }>;
  excludedProcesses: Array<{ processName: string; rationale: string; estimatedImpactPercent: number }>;
  cutoff: { massPercent: number; energyPercent: number; environmentalSignificanceApplied: boolean; rationale: string };
  pcr: { status: 'applicable' | 'not_identified' | 'not_applicable'; name: string; publisher: string; version: string;
    validFrom: string | null; validTo: string | null; rationale: string };
  allocation: { required: boolean; method: 'physical' | 'economic' | 'mass' | 'energy' | 'other' | '';
    rationale: string; hierarchyJustification: string; sensitivityPerformed: boolean; sensitivitySummary: string };
  recyclingModel: { method: string; rationale: string }; dataQualityAssessment: string; dataImprovementPlan: string;
  uncertaintyAssessment: { method: 'qualitative' | 'rss_fallback' | 'monte_carlo'; parameter: string;
    scenario: string; model: string; sensitivityScenarios: string[] };
  landUseChangeMethod: string; biogenicCarbonTreatment: string; evidenceDocumentIds: string[];
  externalAssuranceRecordId: string | null; limitations: string; notes: string;
}
export interface PcfStudyReview {
  id: string; studyId: string; reviewerId: string; reviewerName: string; reviewerEmail: string | null;
  reviewerRole: 'pcf_practitioner_reviewer'; decision: 'approved_for_internal_report' | 'needs_information' | 'rejected';
  notes: string; inputSha256: string; resultSha256: string; calculationCanonicalInputHash: string;
  evidenceSnapshot: Array<{ id: string; type: string; name: string; status: string; checksumSha256: string; fileSizeBytes: number }>;
  createdAt: string;
}
export interface PcfStudy {
  id: string; shipmentId: string; productId: string; calculationSnapshotId: string; studyReference: string; revision: number;
  rulesetId: string; rulesetVersion: string; rulesetCoverage: 'limited' | 'complete'; sourceManifestSha256: string;
  studyDate: string; reportingPeriodStart: string; reportingPeriodEnd: string; calculationCanonicalInputHash: string;
  input: PcfStudyInput; inputSha256: string; resultSha256: string; evidenceSnapshot: PcfStudyReview['evidenceSnapshot'];
  automatedStatus: 'needs_information' | 'practitioner_review_required';
  result: { automatedStatus: PcfStudy['automatedStatus']; missingInputs: string[];
    findings: Array<{ code: string; severity: 'blocker' | 'specialist' | 'warning'; message: string; path: string | null }>;
    sources: Array<{ id: string; title: string; url: string; version: string }>;
    calculation: { snapshotId: string; snapshotVersion: number; canonicalInputHash: string; engineVersion: string;
      methodologyVersion: string; factorRegistryVersion: string; gwpBasis: string; contributionTermCount: number;
      factorCount: number; reportedTotalKgCO2e: number; reproducedTotalKgCO2e: number;
      gwpBreakdown: Record<string, unknown> | null; quality: Record<string, unknown> | null; uncertainty: Record<string, unknown> | null };
    assurance: { id: string; outcome: string; providerName: string; statementDate: string | null } | null;
    claimStatus: 'assurance_record_linked' | 'not_independently_verified'; disclaimer: string; resultSha256: string };
  studyStatus: 'needs_information' | 'practitioner_review_required' | 'approved_for_internal_report'
    | 'evidence_review_required' | 'calculation_superseded' | 'rejected' | 'superseded';
  staleEvidenceIds: string[]; createdBy: string; createdAt: string; latestReview: PcfStudyReview | null;
}

export type EnvironmentalClaimKind =
  | 'generic_environmental' | 'specific_environmental' | 'comparative' | 'future_performance'
  | 'sustainability_label' | 'offset_based_product_climate' | 'legal_requirement_feature' | 'other';

export interface EnvironmentalClaimInput {
  claimReference: string; exactClaimText: string; publicCommunication: boolean;
  channel: 'website' | 'product_label' | 'marketplace' | 'advertising' | 'sales_material' | 'report' | 'other';
  marketCodes: string[]; languageCode: string; communicationStart: string; communicationEnd: string | null;
  subjectType: 'product' | 'sku' | 'batch' | 'shipment' | 'brand' | 'company';
  subjectReference: string; scopeStatement: string; claimKind: EnvironmentalClaimKind;
  specificationText: string; claimScopeMode: 'entire_subject' | 'specific_aspect';
  actualCoverage: 'entire_subject' | 'aspect_only'; recognizedExcellentPerformance: boolean;
  methodology: { standard: string; version: string; pcr: string; calculationSha256: string; datasetReferences: string[]; factorReferences: string[] };
  comparison: { baseline: string; comparator: string; sameMethodAndScope: boolean };
  futureCommitment: { implementationPlanUrl: string; milestones: string[]; independentMonitoring: boolean };
  labelScheme: { schemeType: 'certification_scheme' | 'public_authority' | 'self_declared' | 'other'; schemeName: string; publicCriteriaUrl: string };
  limitations: string[]; exclusions: string[]; uncertaintyStatement: string; qualifiers: string[];
  updateTriggers: string[]; withdrawalTriggers: string[]; assuranceReference: string;
  evidenceDocumentIds: string[]; notes: string;
}

export interface EnvironmentalClaimReview {
  id: string; dossierId: string; reviewerId: string; reviewerName: string; reviewerEmail: string | null;
  reviewerRole: 'legal_claim_reviewer';
  decision: 'approved_for_publication' | 'needs_information' | 'rejected' | 'withdrawn';
  notes: string; inputSha256: string; resultSha256: string;
  evidenceSnapshot: Array<{ id: string; type: string; name: string; status: string; checksumSha256: string; fileSizeBytes: number; validTo: string | null }>;
  createdAt: string;
}

export interface EnvironmentalClaimDossier {
  id: string; shipmentId: string; claimReference: string; revision: number;
  rulesetId: string; rulesetVersion: string; rulesetCoverage: 'limited' | 'complete';
  sourceManifestSha256: string; communicationStart: string; communicationEnd: string | null;
  input: EnvironmentalClaimInput; inputSha256: string;
  result: {
    automatedStatus: 'blocked_prohibited' | 'needs_information' | 'ready_for_legal_review' | 'internal_draft';
    amendedRulesApply: boolean; euConsumerClaim: boolean; missingInputs: string[];
    findings: Array<{ code: string; severity: 'prohibited' | 'blocker' | 'warning' | 'info'; message: string; sourceId: string | null }>;
    sources: Array<{ id: string; title: string; url: string; version: string; appliesFrom: string }>;
    disclaimer: string; resultSha256: string;
  };
  resultSha256: string; evidenceSnapshot: EnvironmentalClaimReview['evidenceSnapshot'];
  automatedStatus: EnvironmentalClaimDossier['result']['automatedStatus'];
  publicationStatus: 'blocked_prohibited' | 'needs_information' | 'internal_draft' | 'legal_review_required'
    | 'evidence_review_required' | 'approved_scheduled' | 'approved_current' | 'expired' | 'withdrawn' | 'rejected' | 'superseded';
  staleEvidenceIds: string[]; createdBy: string; createdAt: string; latestReview: EnvironmentalClaimReview | null;
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
  requiredReviewerRole: 'export_operator' | 'warehouse_reviewer' | 'customs_declaration_reviewer' | 'eu_import_declaration_reviewer' | 'ics2_filing_reviewer' | 'origin_specialist_reviewer' | null;
  latestReview: ExportDocumentReview | null;
  readyToIssue: boolean;
  issuedAt: string | null;
}

export interface ExportDocumentReview {
  id: string;
  documentId: string;
  reviewerRole: 'export_operator' | 'warehouse_reviewer' | 'customs_declaration_reviewer' | 'eu_import_declaration_reviewer' | 'ics2_filing_reviewer' | 'origin_specialist_reviewer';
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
  ics2Profile: Ics2Profile | null;
  ics2Events: Ics2ExternalEvent[];
  ics2Evidence: Array<{
    id: string; type: string; name: string; status: string; checksumSha256: string | null;
    fileSizeBytes: number; validFrom: string | null; validTo: string | null;
    mimeType: string | null; uploadedAt: string; approvedAt: string | null; approvedBy: string | null;
  }>;
  originProfile: OriginProfile | null;
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

export const emptyIcs2Profile = (): Ics2Profile => ({
  schemaId: 'weavecarbon.ics2-filing-handoff', schemaVersion: '1.0.0',
  rulesetVersion: 'R06-ICS2-FILING-HANDOFF-2026.09.1',
  regulatoryBasisVersion: 'UCC-952/2013-ART127+UCC-DA-2015/2446-ANNEX-B@2026-09-12',
  filingPurpose: 'filer_handoff', ics2Release: 'R3', htiAgreementRef: 'EU-ICS2-TI-V2.0',
  transportMode: 'sea', messageDatasetCode: 'F11', filingRole: 'carrier', filingArrangement: 'multiple',
  localReferenceNumber: '', sender: {}, declarant: {}, representative: {}, customsOfficeFirstEntry: '',
  firstEntryCountry: '', estimatedArrivalAt: '', itineraryCountries: [], conveyanceReference: '',
  containerIndicator: true, masterTransportDocument: { type: '', number: '' },
  activeBorderTransportMeans: { identificationType: '', identificationNumber: '', nationality: '' },
  seals: [], paymentMethodCode: '', targetSystemSchemaId: '', targetSystemSchemaVersion: '',
  technicalPackageId: '', technicalPackageVersion: '', messageNamespace: 'urn:wco:datamodel:eu:ics2:2',
  houseConsignments: [], filingNotes: '', metadata: {}
});

export const emptyOriginProfile = (): OriginProfile => ({
  schemaId: 'weavecarbon.evfta-origin-support-handoff', schemaVersion: '1.0.0',
  rulesetVersion: 'R07-EVFTA-ORIGIN-2026.09.1',
  regulatoryBasisVersion: 'EVFTA-PROTOCOL-1-ART2-6+12-16+ANNEX-II@OJ-L186-2020',
  handoffPurpose: 'origin_specialist_review', claimType: 'certificate_application',
  invoiceTotalEur: null, exporterAuthorizationType: 'none', exporterAuthorizationReference: '',
  territorialityConfirmed: false, nonAlterationConfirmed: false,
  insufficientProcessingExcluded: false, lineAssessments: [], notes: '', metadata: {}
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
export const saveIcs2Profile = (shipmentId: string, profile: Ics2Profile) => {
  const input = { ...profile } as Record<string, unknown>;
  [
    'id', 'shipmentId', 'updatedAt', 'schemaId', 'schemaVersion', 'rulesetVersion',
    'regulatoryBasisVersion', 'filingPurpose', 'ics2Release', 'htiAgreementRef'
  ].forEach((key) => delete input[key]);
  return api.put<Ics2Profile>(`${base(shipmentId)}/ics2/profile`, input);
};
export const fetchIcs2Reconciliation = (shipmentId: string) =>
  api.get<Ics2Reconciliation>(`${base(shipmentId)}/ics2/reconciliation`);
export const fetchIcs2Events = (shipmentId: string) =>
  api.get<Ics2ExternalEvent[]>(`${base(shipmentId)}/ics2/events`);
export const recordIcs2Event = (
  shipmentId: string,
  payload: {
    exportDocumentId: string; eventType: Ics2EventType; externalReference: string;
    evidenceDocumentId: string; actorName: string; actorIdentifier?: string;
    messageCode?: string; messageText?: string; occurredAt: string;
  }
) => api.post<Ics2ExternalEvent>(`${base(shipmentId)}/ics2/events`, payload);
export const saveOriginProfile = (shipmentId: string, profile: OriginProfile) => {
  const input = { ...profile } as Record<string, unknown>;
  ['id', 'shipmentId', 'updatedAt', 'schemaId', 'schemaVersion', 'rulesetVersion',
    'regulatoryBasisVersion', 'handoffPurpose'].forEach((key) => delete input[key]);
  return api.put<OriginProfile>(`${base(shipmentId)}/origin/profile`, input);
};
export const fetchOriginReconciliation = (shipmentId: string) =>
  api.get<OriginReconciliation>(`${base(shipmentId)}/origin/reconciliation`);
export const fetchComplianceApplicabilityEvaluations = (shipmentId: string) =>
  api.get<ComplianceApplicabilityEvaluation[]>(`${base(shipmentId)}/compliance/applicability-evaluations`);
export const evaluateComplianceApplicability = (
  shipmentId: string, payload: ComplianceApplicabilityInput
) => api.post<ComplianceApplicabilityEvaluation>(
  `${base(shipmentId)}/compliance/applicability-evaluations`, payload
);
export const reviewComplianceApplicability = (
  shipmentId: string, evaluationId: string,
  payload: {
    reviewerRole: 'compliance_specialist';
    decision: 'confirmed_for_internal_planning' | 'needs_information' | 'rejected';
    notes: string; evidenceDocumentIds?: string[];
  }
) => api.post<ComplianceApplicabilityReview>(
  `${base(shipmentId)}/compliance/applicability-evaluations/${encodeURIComponent(evaluationId)}/reviews`, payload
);
export const fetchTextileFibreLabelSpecifications = (shipmentId: string) =>
  api.get<TextileFibreLabelSpecification[]>(`${base(shipmentId)}/textile-fibre-labels`);
export const createTextileFibreLabelSpecification = (shipmentId: string, payload: TextileFibreLabelInput) =>
  api.post<TextileFibreLabelSpecification>(`${base(shipmentId)}/textile-fibre-labels`, payload);
export const reviewTextileFibreLabelSpecification = (
  shipmentId: string, specificationId: string,
  payload: { reviewerRole: 'textile_label_reviewer'; decision: TextileFibreLabelReview['decision']; notes: string }
) => api.post<TextileFibreLabelReview>(
  `${base(shipmentId)}/textile-fibre-labels/${encodeURIComponent(specificationId)}/reviews`, payload
);
export const fetchGpsrTechnicalFiles = (shipmentId: string) =>
  api.get<GpsrTechnicalFile[]>(`${base(shipmentId)}/gpsr/technical-files`);
export const createGpsrTechnicalFile = (shipmentId: string, payload: GpsrTechnicalFileInput) =>
  api.post<GpsrTechnicalFile>(`${base(shipmentId)}/gpsr/technical-files`, payload);
export const reviewGpsrTechnicalFile = (
  shipmentId: string, technicalFileId: string,
  payload: { reviewerRole: 'product_safety_reviewer'; decision: GpsrTechnicalFileReview['decision']; notes: string }
) => api.post<GpsrTechnicalFileReview>(
  `${base(shipmentId)}/gpsr/technical-files/${encodeURIComponent(technicalFileId)}/reviews`, payload
);
export const fetchGpsrPostMarketEvents = (shipmentId: string, technicalFileId?: string) =>
  api.get<GpsrPostMarketEvent[]>(`${base(shipmentId)}/gpsr/post-market-events${technicalFileId ? `?technicalFileId=${encodeURIComponent(technicalFileId)}` : ''}`);
export const recordGpsrPostMarketEvent = (
  shipmentId: string, technicalFileId: string,
  payload: Pick<GpsrPostMarketEvent, 'eventType' | 'eventReference' | 'occurredAt' | 'summary' | 'severity'>
    & { externalReference?: string; evidenceDocumentId?: string; consumerPersonalDataIncluded?: false; metadata?: Record<string, unknown> }
) => api.post<GpsrPostMarketEvent>(
  `${base(shipmentId)}/gpsr/technical-files/${encodeURIComponent(technicalFileId)}/post-market-events`, payload
);
export const fetchReachSvhcDossiers = (shipmentId: string) =>
  api.get<ReachSvhcDossier[]>(`${base(shipmentId)}/reach/dossiers`);
export const createReachSvhcDossier = (shipmentId: string, payload: ReachSvhcDossierInput) =>
  api.post<ReachSvhcDossier>(`${base(shipmentId)}/reach/dossiers`, payload);
export const reviewReachSvhcDossier = (shipmentId: string, dossierId: string,
  payload: { reviewerRole: 'chemical_compliance_reviewer'; decision: ReachSvhcReview['decision']; notes: string }) =>
  api.post<ReachSvhcReview>(`${base(shipmentId)}/reach/dossiers/${encodeURIComponent(dossierId)}/reviews`, payload);
export const fetchReachObligationEvents = (shipmentId: string, dossierId?: string) =>
  api.get<ReachObligationEvent[]>(`${base(shipmentId)}/reach/obligation-events${dossierId ? `?dossierId=${encodeURIComponent(dossierId)}` : ''}`);
export const recordReachObligationEvent = (shipmentId: string, dossierId: string,
  payload: Pick<ReachObligationEvent, 'eventType' | 'eventReference' | 'occurredAt' | 'summary'>
    & { externalReference?: string; evidenceDocumentId?: string; consumerPersonalDataIncluded?: false; metadata?: Record<string, unknown> }) =>
  api.post<ReachObligationEvent>(`${base(shipmentId)}/reach/dossiers/${encodeURIComponent(dossierId)}/obligation-events`, payload);
export const fetchPcfCalculationSnapshots = (shipmentId: string) =>
  api.get<PcfCalculationSnapshot[]>(`${base(shipmentId)}/pcf/calculation-snapshots`);
export const fetchPcfStudies = (shipmentId: string) =>
  api.get<PcfStudy[]>(`${base(shipmentId)}/pcf/studies`);
export const createPcfStudy = (shipmentId: string, payload: PcfStudyInput) =>
  api.post<PcfStudy>(`${base(shipmentId)}/pcf/studies`, payload);
export const reviewPcfStudy = (shipmentId: string, studyId: string,
  payload: { reviewerRole: 'pcf_practitioner_reviewer'; decision: PcfStudyReview['decision']; notes: string }) =>
  api.post<PcfStudyReview>(`${base(shipmentId)}/pcf/studies/${encodeURIComponent(studyId)}/reviews`, payload);
export const fetchEnvironmentalClaimDossiers = (shipmentId: string) =>
  api.get<EnvironmentalClaimDossier[]>(`${base(shipmentId)}/environmental-claims`);
export const createEnvironmentalClaimDossier = (shipmentId: string, payload: EnvironmentalClaimInput) =>
  api.post<EnvironmentalClaimDossier>(`${base(shipmentId)}/environmental-claims`, payload);
export const reviewEnvironmentalClaimDossier = (
  shipmentId: string, dossierId: string,
  payload: { reviewerRole: 'legal_claim_reviewer'; decision: EnvironmentalClaimReview['decision']; notes: string }
) => api.post<EnvironmentalClaimReview>(
  `${base(shipmentId)}/environmental-claims/${encodeURIComponent(dossierId)}/reviews`, payload
);
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
  payload: { reviewerRole: 'export_operator' | 'warehouse_reviewer' | 'customs_declaration_reviewer' | 'eu_import_declaration_reviewer' | 'ics2_filing_reviewer' | 'origin_specialist_reviewer'; decision: 'approved' | 'rejected' | 'changes_requested'; notes?: string }
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

export const uploadIcs2Evidence = async (
  shipmentId: string,
  file: File,
  kind: 'ics2_filer_response' | 'ics2_customs_response' | 'ics2_ens_declaration'
) => {
  const body = new FormData();
  body.append('file', file);
  body.append('shipmentId', shipmentId);
  body.append('kind', kind);
  body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('ICS2 evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockIcs2Evidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadOriginEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData();
  body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'origin_support'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('Origin-support upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockOriginEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadComplianceApplicabilityEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData();
  body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'compliance_assessment'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('Compliance evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockComplianceApplicabilityEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadTextileFibreLabelEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData();
  body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'textile_composition_test'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('Textile-label evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockTextileFibreLabelEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadGpsrEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData();
  body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'gpsr_technical_file'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('GPSR evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockGpsrEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadReachEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData(); body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'reach_lab_report'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('REACH evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};
export const lockReachEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadPcfStudyEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData(); body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'pcf_source'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('PCF evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};
export const lockPcfStudyEvidence = (evidenceId: string) =>
  api.post<Record<string, unknown>>(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

export const uploadEnvironmentalClaimEvidence = async (shipmentId: string, file: File) => {
  const body = new FormData();
  body.append('file', file); body.append('shipmentId', shipmentId);
  body.append('kind', 'environmental_claim_substantiation'); body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string } };
  if (!payload.data?.id) throw new Error('Environmental-claim evidence upload did not return an evidence id.');
  return payload.data as { id: string };
};

export const lockEnvironmentalClaimEvidence = (evidenceId: string) =>
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
