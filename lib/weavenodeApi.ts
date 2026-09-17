import { api } from "@/lib/apiClient";

export interface WeavenodeHealth {
  id: string; sequenceNumber: number; recordedAt: string; gatewayReceivedAt: string; serverReceivedAt: string;
  clockDriftSeconds: number; firmwareVersion: string; configVersion: string; bufferDepth: number;
  storageFreeBytes: number; sensorStatus: "ok" | "warning" | "fault"; faultCodes: string[]; payloadSha256: string;
}

export interface WeavenodeUpdate {
  id: string; deviceId: string; updateReference: string; revision: number; updateKind: "firmware" | "configuration";
  targetVersion: string; rolloutStage: "staged" | "canary" | "production" | "rollback";
  artifactSha256: string; signingKeyId: string; manifest: Record<string, unknown>; manifestSha256: string;
  rollbackOfUpdateId: string | null; reason: string; createdAt: string;
}

export interface WeavenodeDevice {
  id: string; deviceReference: string; measurementPointRevisionId: string; measurementPointReference: string;
  canonicalUnit: string; publicKeySha256: string; protocolVersion: "weavenode-ed25519-v1" | "weavenode-ed25519-v2";
  revoked: boolean; lastAcceptedSequence: number; bufferedCount: number;
  latestHealth: Record<string, unknown> | null; latestUpdate: Record<string, unknown> | null; createdAt: string;
}

export interface MeterHierarchy {
  id: string; facilityRevisionId: string; hierarchyReference: string; revision: number;
  parentMeasurementPointRevisionId: string; parentReference?: string; childMeasurementPointRevisionId: string;
  childReference?: string; relationKind: "sub_meter" | "line_meter" | "machine_meter";
  tolerancePercent: number; effectiveFrom: string; effectiveTo: string | null; evidenceDocumentId: string;
  hierarchySha256: string; createdAt: string;
}

export interface MeterReconciliation {
  id: string; facilityRevisionId: string; parentMeasurementPointRevisionId: string; periodStart: string; periodEnd: string;
  canonicalUnit: string; parentQuantity: number; childQuantity: number; differenceQuantity: number;
  differencePercent: number | null; tolerancePercent: number; status: "reconciled" | "outside_tolerance" | "missing_data";
  payloadSha256: string; createdAt: string;
}

export interface ReleaseKey {
  id: string; keyReference: string; publicKeySha256: string; revoked: boolean; createdAt: string;
}

export const weavenodeApi = {
  devices: () => api.get<WeavenodeDevice[]>("/weavenode/devices"),
  health: (deviceId: string) => api.get<WeavenodeHealth[]>(`/weavenode/devices/${encodeURIComponent(deviceId)}/health`),
  updates: (deviceId: string) => api.get<WeavenodeUpdate[]>(`/weavenode/devices/${encodeURIComponent(deviceId)}/updates`),
  createUpdate: (deviceId: string, input: Record<string, unknown>) =>
    api.post<WeavenodeUpdate>(`/weavenode/devices/${encodeURIComponent(deviceId)}/updates`, input),
  hierarchies: () => api.get<MeterHierarchy[]>("/weavenode/meter-hierarchies"),
  createHierarchy: (input: Record<string, unknown>) => api.post<MeterHierarchy>("/weavenode/meter-hierarchies", input),
  reconciliations: () => api.get<MeterReconciliation[]>("/weavenode/meter-reconciliations"),
  reconcile: (input: Record<string, unknown>) => api.post<MeterReconciliation>("/weavenode/meter-reconciliations", input),
  releaseKeys: () => api.get<ReleaseKey[]>("/weavenode/release-keys"),
  createReleaseKey: (input: { keyReference: string; publicKeyPem: string }) => api.post<ReleaseKey>("/weavenode/release-keys", input)
};
