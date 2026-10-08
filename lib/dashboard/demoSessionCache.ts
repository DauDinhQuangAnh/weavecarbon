// Client-side cache for isolated demo operations.
// Data is stored in sessionStorage with a 1-hour TTL and is automatically cleared upon session end/logout.
// Enterprise backend APIs and production databases are NEVER mutated in demo mode.

import {
  INDUSTRIAL_DEMO,
  DEMO_FACTORS,
  demoActivityLineage,
} from "./industrialDemoData";
import type {
  IndustrialActivity,
  IndustrialActivityLineage,
  IndustrialFacility,
  IndustrialProcess,
} from "@/lib/industrialCoreApi";
import type { DqlAssessment, FactorProposal } from "@/lib/dataGovernanceApi";
import type { VnMrvCase } from "@/lib/vnMrvApi";

const CACHE_PREFIX = "weavecarbon_demo_session_v1_";
const TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEnvelope<T> {
  timestamp: number;
  data: T;
}

const memoryStore = new Map<string, CacheEnvelope<unknown>>();

const isBrowser = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

function getCached<T>(key: string, fallback: () => T): T {
  const fullKey = CACHE_PREFIX + key;
  const now = Date.now();

  // Try memoryStore first
  if (memoryStore.has(fullKey)) {
    const entry = memoryStore.get(fullKey) as CacheEnvelope<T>;
    if (now - entry.timestamp <= TTL_MS) {
      return entry.data;
    }
    memoryStore.delete(fullKey);
  }

  // Try sessionStorage
  if (isBrowser()) {
    try {
      const raw = window.sessionStorage.getItem(fullKey);
      if (raw) {
        const parsed = JSON.parse(raw) as CacheEnvelope<T>;
        if (now - parsed.timestamp <= TTL_MS) {
          memoryStore.set(fullKey, parsed);
          return parsed.data;
        }
        window.sessionStorage.removeItem(fullKey);
      }
    } catch {
      // Ignore parse/quota errors
    }
  }

  const initial = fallback();
  setCached(key, initial);
  return initial;
}

function setCached<T>(key: string, data: T): void {
  const fullKey = CACHE_PREFIX + key;
  const envelope: CacheEnvelope<T> = { timestamp: Date.now(), data };
  memoryStore.set(fullKey, envelope as CacheEnvelope<unknown>);

  if (isBrowser()) {
    try {
      window.sessionStorage.setItem(fullKey, JSON.stringify(envelope));
    } catch {
      // Ignore sessionStorage quota errors
    }
  }
}

export function clearDemoSessionCache(): void {
  memoryStore.clear();
  if (isBrowser()) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => window.sessionStorage.removeItem(k));
    } catch {
      // Ignore
    }
  }
}

export const demoSessionCache = {
  clear: clearDemoSessionCache,

  // 1. Facilities
  getFacilities(): IndustrialFacility[] {
    return getCached<IndustrialFacility[]>("facilities", () => [...INDUSTRIAL_DEMO.facilities]);
  },
  addFacility(facility: Partial<IndustrialFacility> & { facilityReference: string; name: string }): IndustrialFacility {
    const list = this.getFacilities();
    const newFacility: IndustrialFacility = {
      id: `demo-facility-${Date.now()}`,
      facilityReference: facility.facilityReference,
      revision: (list.filter((f) => f.facilityReference === facility.facilityReference).length || 0) + 1,
      name: facility.name,
      countryCode: facility.countryCode || "VN",
      timezone: facility.timezone || "Asia/Ho_Chi_Minh",
      lifecycleStatus: facility.lifecycleStatus || "active",
      boundaryNotes: facility.boundaryNotes || "Ranh giới demo lưu trên cache tạm thời",
      metadata: facility.metadata || { demoCache: true },
      createdAt: new Date().toISOString(),
    };
    const updated = [newFacility, ...list];
    setCached("facilities", updated);
    return newFacility;
  },

  // 2. Processes
  getProcesses(): IndustrialProcess[] {
    return getCached<IndustrialProcess[]>("processes", () => [...INDUSTRIAL_DEMO.processes]);
  },
  addProcess(process: Partial<IndustrialProcess> & { facilityRevisionId: string; processReference: string; name: string }): IndustrialProcess {
    const list = this.getProcesses();
    const newProcess: IndustrialProcess = {
      id: `demo-process-${Date.now()}`,
      facilityRevisionId: process.facilityRevisionId,
      facilityReference: process.facilityReference || "DEMO-FACTORY",
      processReference: process.processReference,
      revision: (list.filter((p) => p.processReference === process.processReference).length || 0) + 1,
      name: process.name,
      processType: process.processType || "production",
      lifecycleStatus: process.lifecycleStatus || "active",
      createdAt: new Date().toISOString(),
    };
    const updated = [newProcess, ...list];
    setCached("processes", updated);
    return newProcess;
  },

  // 3. Activities
  getActivities(): IndustrialActivity[] {
    return getCached<IndustrialActivity[]>("activities", () => [...INDUSTRIAL_DEMO.activities]);
  },
  addActivity(activity: Partial<IndustrialActivity> & { activityReference: string; quantity: number }): IndustrialActivity {
    const list = this.getActivities();
    const facilities = this.getFacilities();
    const facility = facilities.find((f) => f.id === activity.facilityRevisionId) || facilities[0];
    const newActivity: IndustrialActivity = {
      id: `demo-act-${Date.now()}`,
      activityReference: activity.activityReference,
      facilityRevisionId: facility.id,
      processRevisionId: activity.processRevisionId || null,
      measurementPointRevisionId: activity.measurementPointRevisionId || null,
      facilityReference: facility.facilityReference,
      activityType: activity.activityType || "electricity",
      periodStart: activity.periodStart || new Date().toISOString().slice(0, 10),
      periodEnd: activity.periodEnd || new Date().toISOString().slice(0, 10),
      quantity: Number(activity.quantity),
      canonicalUnit: activity.canonicalUnit || "kWh",
      sourceKind: activity.sourceKind || "manual",
      dataQualityLevel: activity.dataQualityLevel || "L2",
      sourceSha256: `demo-sha256-${Date.now().toString(16).repeat(4)}`,
      evidenceDocumentIds: activity.evidenceDocumentIds || [],
    };
    const updated = [newActivity, ...list];
    setCached("activities", updated);
    return newActivity;
  },

  // 4. Activity Lineage & Reviews
  getLineage(activityId: string): IndustrialActivityLineage | null {
    const base = demoActivityLineage(activityId);
    if (!base) {
      // Check if it's a freshly added demo activity
      const activity = this.getActivities().find((a) => a.id === activityId);
      if (!activity) return null;
      const facility = this.getFacilities().find((f) => f.id === activity.facilityRevisionId) || this.getFacilities()[0];
      return {
        activity,
        facility: { id: facility.id, reference: facility.facilityReference, name: facility.name },
        process: null,
        measurementPoint: null,
        evidence: [],
        latestReview: null,
      };
    }
    // Check if there is an updated review in cache
    const reviews = getCached<Record<string, IndustrialActivityLineage["latestReview"]>>("lineage_reviews", () => ({}));
    if (reviews[activityId]) {
      return { ...base, latestReview: reviews[activityId] };
    }
    return base;
  },
  saveActivityReview(
    activityId: string,
    review: { decision: "approved" | "needs_information" | "rejected"; notes: string; reviewerName?: string }
  ): void {
    const reviews = getCached<Record<string, IndustrialActivityLineage["latestReview"]>>("lineage_reviews", () => ({}));
    const reviewRecord = {
      id: `demo-review-${Date.now()}`,
      activityId,
      reviewerId: "demo-reviewer",
      reviewerName: review.reviewerName || "Chuyên viên Review Demo",
      reviewerRole: "industrial_activity_reviewer" as const,
      decision: review.decision,
      notes: review.notes,
      sourceSha256: "demo-review-sha256",
      evidenceSnapshot: [],
      createdAt: new Date().toISOString(),
    };
    reviews[activityId] = reviewRecord;
    setCached("lineage_reviews", { ...reviews });
  },

  // 5. Factors
  getFactors(): FactorProposal[] {
    return getCached<FactorProposal[]>("factors", () => [...DEMO_FACTORS]);
  },
  addFactor(factor: Partial<FactorProposal> & { proposalReference: string; label: string; factorValue: number }): FactorProposal {
    const list = this.getFactors();
    const newFactor: FactorProposal = {
      id: `demo-factor-${Date.now()}`,
      proposalReference: factor.proposalReference,
      revision: (list.filter((f) => f.proposalReference === factor.proposalReference).length || 0) + 1,
      factorId: factor.factorId || `demo-${Date.now()}`,
      label: factor.label,
      factorValue: Number(factor.factorValue),
      unit: factor.unit || "kgCO2e/unit",
      sourceName: factor.sourceName || "Tự khai báo demo (cache tạm thời)",
      geography: factor.geography || "VN",
      governanceStatus: "approved_for_release_candidate",
      createdAt: new Date().toISOString(),
    };
    const updated = [newFactor, ...list];
    setCached("factors", updated);
    return newFactor;
  },
  updateFactorStatus(id: string, status: FactorProposal["governanceStatus"]): void {
    const list = this.getFactors().map((f) => (f.id === id ? { ...f, governanceStatus: status } : f));
    setCached("factors", list);
  },

  // 6. DQL Assessments
  getDql(): DqlAssessment[] {
    return getCached<DqlAssessment[]>("dql", () => [
      {
        id: "demo-dql-1",
        subjectType: "activity",
        subjectReference: "DEMO-DYE-ELECTRICITY",
        methodologyVersion: "GHG_PROTOCOL_V1",
        overallScore: 4.2,
        dataQualityLevel: "L2",
        completenessPercent: 95,
        rationale: "Đồng hồ đo điện có chứng từ hóa đơn hỗ trợ",
        createdAt: "2026-09-30T00:00:00Z",
      },
    ]);
  },
  addDql(dql: Partial<DqlAssessment>): DqlAssessment {
    const list = this.getDql();
    const newDql: DqlAssessment = {
      id: `demo-dql-${Date.now()}`,
      subjectType: dql.subjectType || "activity",
      subjectReference: dql.subjectReference || "DEMO-ACTIVITY",
      methodologyVersion: dql.methodologyVersion || "GHG_PROTOCOL_V1",
      overallScore: Number(dql.overallScore || 4.0),
      dataQualityLevel: dql.dataQualityLevel || "L2",
      completenessPercent: Number(dql.completenessPercent || 90),
      rationale: dql.rationale || "Đánh giá thử nghiệm demo",
      createdAt: new Date().toISOString(),
    };
    const updated = [newDql, ...list];
    setCached("dql", updated);
    return newDql;
  },

  // 7. VN MRV Cases, Plans & Filings
  getMrvCases(): VnMrvCase[] {
    return getCached<VnMrvCase[]>("mrv_cases", () => [
      {
        id: "demo-case-1",
        caseReference: "MRV-2026-FAC-01",
        revision: 1,
        facilityRevisionId: INDUSTRIAL_DEMO.facilities[0].id,
        facilityName: INDUSTRIAL_DEMO.facilities[0].name,
        reportingYear: 2026,
        sector: "textile",
        applicabilityStatus: "applicable",
        legalBasis: {
          sources: [
            { id: "nd-06-2022", title: "Nghị định 06/2022/NĐ-CP" },
          ],
        },
        rationale: "Trường hợp MRV mô phỏng theo kế hoạch giảm nhẹ.",
      },
    ]);
  },
  addMrvCase(item: { facilityId?: string; facilityRevisionId?: string; caseReference: string; reportingYear: number; sector?: string; facilityName?: string }): VnMrvCase {
    const list = this.getMrvCases();
    const newCase: VnMrvCase = {
      id: `demo-case-${Date.now()}`,
      caseReference: item.caseReference,
      revision: 1,
      facilityRevisionId: item.facilityRevisionId || item.facilityId || INDUSTRIAL_DEMO.facilities[0].id,
      facilityName: item.facilityName || INDUSTRIAL_DEMO.facilities[0].name,
      reportingYear: Number(item.reportingYear),
      sector: item.sector || "textile",
      applicabilityStatus: "applicable",
      legalBasis: {
        sources: [
          { id: "nd-06-2022", title: "Nghị định 06/2022/NĐ-CP" },
        ],
      },
      rationale: "Khai báo tình huống mô phỏng demo",
    };
    const updated = [newCase, ...list];
    setCached("mrv_cases", updated);
    return newCase;
  },

  // 8. WeaveNode Devices & Readings
  getWeavenodeDevices(): Array<{ id: string; name: string; deviceReference: string; status: string; facilityName: string; protocol: string; lastPingAt: string }> {
    return getCached("weavenode_devices", () => [
      {
        id: "demo-dev-1",
        name: "WeaveNode Modbus Gateway 01",
        deviceReference: "NODE-GW-01",
        status: "active",
        facilityName: INDUSTRIAL_DEMO.facilities[0].name,
        protocol: "MQTT / Modbus-RTU",
        lastPingAt: new Date().toISOString(),
      },
      {
        id: "demo-dev-2",
        name: "Công tơ điện phụ Dệt may",
        deviceReference: "NODE-EM-02",
        status: "active",
        facilityName: "Xưởng nhuộm minh họa",
        protocol: "Modbus-TCP",
        lastPingAt: new Date().toISOString(),
      },
    ]);
  },
  addWeavenodeDevice(device: { name: string; deviceReference: string; facilityName?: string; protocol?: string }) {
    const list = this.getWeavenodeDevices();
    const newDev = {
      id: `demo-dev-${Date.now()}`,
      name: device.name,
      deviceReference: device.deviceReference,
      status: "active",
      facilityName: device.facilityName || INDUSTRIAL_DEMO.facilities[0].name,
      protocol: device.protocol || "MQTT",
      lastPingAt: new Date().toISOString(),
    };
    const updated = [newDev, ...list];
    setCached("weavenode_devices", updated);
    return newDev;
  },

  // 9. Suppliers & Requests
  getSuppliers(): Array<{ id: string; name: string; country: string; tier: number; category: string; status: string }> {
    return getCached("suppliers", () => [
      { id: "demo-sup-1", name: "Công ty Cung ứng Sợi Việt", country: "VN", tier: 1, category: "Nguyên phụ liệu", status: "active" },
      { id: "demo-sup-2", name: "Dệt Nhuộm Nam Định Eco", country: "VN", tier: 2, category: "Gia công nhuộm", status: "active" },
    ]);
  },
  addSupplier(sup: { name: string; country?: string; tier?: number; category?: string }) {
    const list = this.getSuppliers();
    const newSup = {
      id: `demo-sup-${Date.now()}`,
      name: sup.name,
      country: sup.country || "VN",
      tier: sup.tier || 1,
      category: sup.category || "Vật liệu",
      status: "active",
    };
    const updated = [newSup, ...list];
    setCached("suppliers", updated);
    return newSup;
  },
};
