import { api } from '@/lib/apiClient';

export type ExportDocumentType =
  | 'commercial_invoice'
  | 'packing_list'
  | 'carbon_annex'
  | 'origin_workbook'
  | 'ics2_dataset';

export type ExportOutputFormat = 'xlsx' | 'pdf' | 'csv';

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
  portOfLoading: string;
  portOfDischarge: string;
  placeOfDelivery: string;
  vesselName: string;
  voyageNumber: string;
  billOfLadingNo: string;
  containerNo: string;
  sealNo: string;
  customsDeclarationNo: string;
  freightAmount: number | null;
  insuranceAmount: number | null;
  discountAmount: number | null;
  surchargeAmount: number | null;
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
  hsCodeConfirmedBy: string | null;
  hsCodeConfirmedAt: string | null;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  currency: string;
  netWeightKg: number | null;
  grossWeightKg: number | null;
  embeddedCo2eKg: number | null;
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
  issuedAt: string | null;
}

export interface ShipmentExportBundle {
  shipment: { id: string; referenceNumber: string; status: string; originCountry: string; destinationCountry: string };
  profile: ShipmentExportProfile | null;
  lines: ShipmentExportLine[];
  containers: ShipmentContainer[];
  packages: ShipmentPackage[];
  carrierDocuments: Array<{ id: string; type: string; name: string; status: string; checksumSha256?: string | null }>;
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
  exporterTaxId: '', importerEori: '', portOfLoading: '', portOfDischarge: '', placeOfDelivery: '',
  vesselName: '', voyageNumber: '', billOfLadingNo: '', containerNo: '', sealNo: '',
  customsDeclarationNo: '', freightAmount: null, insuranceAmount: null,
  discountAmount: null, surchargeAmount: null, transportMode: '',
  preferentialOriginClaim: false, metadata: {}
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

export const uploadCarrierDocument = async (shipmentId: string, file: File, kind = 'carrier_bill_of_lading') => {
  const body = new FormData();
  body.append('file', file);
  body.append('shipmentId', shipmentId);
  body.append('kind', kind);
  body.append('documentName', file.name);
  const response = await api.raw('/evidence/upload', { method: 'POST', body });
  const payload = await response.json() as { data?: { id?: string }; success?: boolean };
  const id = payload.data?.id;
  if (!id) throw new Error('Carrier document upload did not return an evidence id.');
  return payload.data;
};

export const approveCarrierDocument = (evidenceId: string) =>
  api.post(`/evidence/${encodeURIComponent(evidenceId)}/lock`, {});

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
