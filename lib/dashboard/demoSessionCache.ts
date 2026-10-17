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
import type {
  SupplierProfile,
  SupplierSite,
  SupplierRelationship,
  SupplierClimateAssessment,
  CarbonCriticalitySnapshot,
  CriticalityModel,
  CriticalitySnapshot,
  CriticalityPortfolio,
} from "@/lib/supplierNetworkApi";
import type {
  ClimateLocation,
  ClimateAssessment,
  ClimatePortfolio,
} from "@/lib/climateRiskApi";

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

  getSupplierRequests(): Array<{
    id: string;
    supplierName: string;
    supplierEmail: string;
    materialSupplied: string | null;
    requiredData: string[];
    deadline: string | null;
    status: "draft" | "sent" | "waiting" | "received" | "overdue";
  }> {
    return getCached("supplier_requests", () => [
      {
        id: "demo-sreq-1",
        supplierName: "Công ty Cổ phần Dệt Nam Định Eco",
        supplierEmail: "contact@namdinheco-textile.vn",
        materialSupplied: "Vải Organic Cotton dệt thoi",
        requiredData: ["Hóa đơn điện EVN xưởng dệt", "Chứng nhận xuất xứ xơ bông GOTS", "Định mức tiêu hao năng lượng"],
        deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        status: "waiting",
      },
      {
        id: "demo-sreq-2",
        supplierName: "Tập đoàn Hóa chất Nhuộm Vĩnh Thịnh",
        supplierEmail: "esg@vinhthinhchem.com.vn",
        materialSupplied: "Thuốc nhuộm hoạt tính Reactive Blue & Black",
        requiredData: ["Báo cáo kiểm kê KNK nhà máy", "Dấu chân carbon sản phẩm PCF (kgCO2e/kg)", "Chứng chỉ an toàn ZDHC Level 3"],
        deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
        status: "received",
      },
      {
        id: "demo-sreq-3",
        supplierName: "Công ty Bao bì Giấy Tân Á Châu",
        supplierEmail: "sales@tanachau-pack.vn",
        materialSupplied: "Thùng carton 5 lớp & nhãn mác tái chế",
        requiredData: ["Tỷ lệ nguyên liệu tái chế (%)", "Chứng chỉ chuỗi hành trình FSC-CoC"],
        deadline: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        status: "overdue",
      },
      {
        id: "demo-sreq-4",
        supplierName: "Công ty TNHH Phụ liệu May Hưng Phát",
        supplierEmail: "hungphat@garmentaccessories.vn",
        materialSupplied: "Chỉ may Polyester tái chế & cúc áo sinh học",
        requiredData: ["Chứng nhận OEKO-TEX Standard 100", "Công bố phát thải Scope 1/2"],
        deadline: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
        status: "draft",
      },
    ]);
  },
  addSupplierRequest(req: {
    supplierName: string;
    supplierEmail: string;
    materialSupplied: string | null;
    requiredData: string[];
    deadline: string | null;
    status?: "draft" | "sent" | "waiting" | "received" | "overdue";
  }) {
    const list = this.getSupplierRequests();
    const newReq = {
      id: `demo-sreq-${Date.now()}`,
      supplierName: req.supplierName,
      supplierEmail: req.supplierEmail,
      materialSupplied: req.materialSupplied,
      requiredData: req.requiredData,
      deadline: req.deadline,
      status: req.status || ("draft" as const),
    };
    const updated = [newReq, ...list];
    setCached("supplier_requests", updated);
    return newReq;
  },
  updateSupplierRequest(
    id: string,
    updates: Partial<{ status: "draft" | "sent" | "waiting" | "received" | "overdue"; deadline: string | null }>
  ) {
    const list = this.getSupplierRequests().map((r) => (r.id === id ? { ...r, ...updates } : r));
    setCached("supplier_requests", list);
    return list.find((r) => r.id === id);
  },

  getSupplierProfiles(): SupplierProfile[] {
    return getCached("supplier_profiles", () => [
      {
        id: "demo-sup-1",
        supplierReference: "SUP-SGN-YARN-01",
        revision: 1,
        legalName: "Công ty Cung ứng Sợi Việt",
        tradingName: "Viet Yarn Supply Corp",
        countryCode: "VN",
        sector: "Nguyên phụ liệu sợi dệt",
        supplierTier: 1,
        lifecycleStatus: "active",
        evidenceSnapshot: { id: "demo-ev-sup-1", checksumSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
        profileSha256: "c1".repeat(32),
        createdAt: "2026-01-10T08:00:00Z",
      },
      {
        id: "demo-sup-2",
        supplierReference: "SUP-ND-ECO-02",
        revision: 1,
        legalName: "Dệt Nhuộm Nam Định Eco",
        tradingName: "Nam Dinh Eco Dyeing JSC",
        countryCode: "VN",
        sector: "Gia công nhuộm hoàn tất",
        supplierTier: 2,
        lifecycleStatus: "active",
        evidenceSnapshot: { id: "demo-ev-sup-2", checksumSha256: "a1".repeat(32) },
        profileSha256: "c2".repeat(32),
        createdAt: "2026-02-15T09:30:00Z",
      },
    ]);
  },
  addSupplierProfile(profile: Partial<SupplierProfile>): SupplierProfile {
    const list = this.getSupplierProfiles();
    const newProfile: SupplierProfile = {
      id: `demo-sup-${Date.now()}`,
      supplierReference: profile.supplierReference || `SUP-REF-${Date.now().toString().slice(-4)}`,
      revision: 1,
      legalName: profile.legalName || "Công ty Cung ứng Mới",
      tradingName: profile.tradingName || profile.legalName,
      countryCode: profile.countryCode || "VN",
      sector: profile.sector || "Vật liệu",
      supplierTier: Number(profile.supplierTier) || 1,
      lifecycleStatus: profile.lifecycleStatus || "active",
      evidenceSnapshot: { id: profile.evidenceSnapshot?.id || "demo-ev-auto", checksumSha256: "d1".repeat(32) },
      profileSha256: "d2".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newProfile, ...list];
    setCached("supplier_profiles", updated);
    return newProfile;
  },

  getSupplierSites(): SupplierSite[] {
    return getCached("supplier_sites", () => [
      {
        id: "demo-site-1",
        supplierRevisionId: "demo-sup-1",
        supplierReference: "SUP-SGN-YARN-01",
        supplierName: "Công ty Cung ứng Sợi Việt",
        siteReference: "SITE-BDG-01",
        revision: 1,
        siteName: "Nhà máy Kéo sợi Bến Cát (Bình Dương)",
        countryCode: "VN",
        latitude: 11.1356,
        longitude: 106.6025,
        precisionMeters: 50,
        locationBasis: "Trích lục bản đồ địa chính KCN Mỹ Phước",
        evidenceSnapshot: { id: "demo-ev-site-1", checksumSha256: "s1".repeat(32) },
        siteSha256: "s2".repeat(32),
        createdAt: "2026-01-12T00:00:00Z",
      },
    ]);
  },
  addSupplierSite(site: Partial<SupplierSite>): SupplierSite {
    const list = this.getSupplierSites();
    const newSite: SupplierSite = {
      id: `demo-site-${Date.now()}`,
      supplierRevisionId: site.supplierRevisionId || "demo-sup-1",
      siteReference: site.siteReference || `SITE-${Date.now().toString().slice(-4)}`,
      revision: 1,
      siteName: site.siteName || "Cơ sở cung ứng mới",
      countryCode: site.countryCode || "VN",
      latitude: Number(site.latitude) || 10.823,
      longitude: Number(site.longitude) || 106.629,
      precisionMeters: Number(site.precisionMeters) || 100,
      locationBasis: site.locationBasis || "Định vị GPS tại chỗ",
      evidenceSnapshot: { id: "demo-ev-site", checksumSha256: "s3".repeat(32) },
      siteSha256: "s4".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newSite, ...list];
    setCached("supplier_sites", updated);
    return newSite;
  },

  getSupplierRelationships(): SupplierRelationship[] {
    return getCached("supplier_relationships", () => [
      {
        id: "demo-rel-1",
        supplierRevisionId: "demo-sup-1",
        supplierReference: "SUP-SGN-YARN-01",
        supplierName: "Công ty Cung ứng Sợi Việt",
        relationshipReference: "REL-YARN-CONTRACT-2026",
        revision: 1,
        materialOrService: "Sợi Organic Cotton chải kỹ Ne 30/1",
        procurementCategory: "Raw Materials",
        spendPercent: 42.5,
        productionDependencyPercent: 65.0,
        singleSource: false,
        dependentSkuCount: 18,
        dependentRouteCount: 4,
        effectiveFrom: "2026-01-01",
        effectiveTo: "2026-12-31",
        relationshipSha256: "r1".repeat(32),
        createdAt: "2026-01-15T00:00:00Z",
      },
    ]);
  },
  addSupplierRelationship(rel: Partial<SupplierRelationship>): SupplierRelationship {
    const list = this.getSupplierRelationships();
    const newRel: SupplierRelationship = {
      id: `demo-rel-${Date.now()}`,
      supplierRevisionId: rel.supplierRevisionId || "demo-sup-1",
      relationshipReference: rel.relationshipReference || `REL-${Date.now().toString().slice(-4)}`,
      revision: 1,
      materialOrService: rel.materialOrService || "Vật tư phụ",
      procurementCategory: rel.procurementCategory || "Nguyên vật liệu",
      spendPercent: Number(rel.spendPercent) || 10,
      productionDependencyPercent: Number(rel.productionDependencyPercent) || 15,
      singleSource: Boolean(rel.singleSource),
      dependentSkuCount: Number(rel.dependentSkuCount) || 1,
      dependentRouteCount: Number(rel.dependentRouteCount) || 1,
      effectiveFrom: rel.effectiveFrom || new Date().toISOString().slice(0, 10),
      effectiveTo: rel.effectiveTo || null,
      relationshipSha256: "r2".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newRel, ...list];
    setCached("supplier_relationships", updated);
    return newRel;
  },

  getSupplierClimate(): SupplierClimateAssessment[] {
    return getCached("supplier_climate", () => [
      {
        id: "demo-scli-1",
        supplierRevisionId: "demo-sup-1",
        supplierReference: "SUP-SGN-YARN-01",
        supplierName: "Công ty Cung ứng Sợi Việt",
        siteRevisionId: "demo-site-1",
        siteReference: "SITE-BDG-01",
        siteName: "Nhà máy Kéo sợi Bến Cát",
        hazardType: "heat",
        scenarioKind: "projection",
        scenarioReference: "CMIP6-SSP2-4.5-2030",
        horizonStart: "2026",
        horizonEnd: "2030",
        sourceKind: "CMIP6",
        sourceUrl: "https://cds.climate.copernicus.eu",
        datasetIdentifier: "projections-cmip6-single-levels",
        datasetVersion: "v1.0",
        spatialResolution: "0.25 deg",
        temporalResolution: "daily",
        gridReference: "GRID-VN-BDG-11-106",
        spatialMatchNotes: "Ghép ô lưới nội suy trung tâm KCN Mỹ Phước",
        modelName: "EC-Earth3",
        scenarioName: "SSP2-4.5",
        hazardMetric: "Số ngày nắng nóng cực đoan (Tx > 35°C)",
        metricValue: 62,
        metricUnit: "ngày/năm",
        uncertaintyNotes: "Độ tin cậy mô hình khí hậu 85%",
        exposureRating: 4,
        vulnerabilityRating: 3,
        priorityBand: "medium",
        ratingRationale: "Ảnh hưởng tải nhiệt xưởng kéo sợi và chi phí làm mát",
        screeningStatus: "completed",
        inputSha256: "sc1".repeat(32),
        createdAt: "2026-02-01T00:00:00Z",
      },
    ]);
  },
  addSupplierClimate(cli: Partial<SupplierClimateAssessment>): SupplierClimateAssessment {
    const list = this.getSupplierClimate();
    const newCli: SupplierClimateAssessment = {
      id: `demo-scli-${Date.now()}`,
      supplierRevisionId: cli.supplierRevisionId || "demo-sup-1",
      siteRevisionId: cli.siteRevisionId || "demo-site-1",
      hazardType: cli.hazardType || "heat",
      scenarioKind: cli.scenarioKind || "projection",
      scenarioReference: cli.scenarioReference || "CMIP6-SSP2-4.5",
      horizonStart: cli.horizonStart || "2026",
      horizonEnd: cli.horizonEnd || "2030",
      sourceKind: cli.sourceKind || "CMIP6",
      sourceUrl: cli.sourceUrl || "https://cds.climate.copernicus.eu",
      datasetIdentifier: cli.datasetIdentifier || "cmip6-data",
      datasetVersion: cli.datasetVersion || "v1",
      spatialResolution: cli.spatialResolution || "0.25 deg",
      temporalResolution: cli.temporalResolution || "daily",
      gridReference: cli.gridReference || "GRID-VN-DEFAULT",
      spatialMatchNotes: cli.spatialMatchNotes || "Ghép ô lưới GPS",
      hazardMetric: cli.hazardMetric || "Chỉ tiêu hazard",
      metricValue: Number(cli.metricValue) || 50,
      metricUnit: cli.metricUnit || "đơn vị",
      uncertaintyNotes: cli.uncertaintyNotes || "Mô phỏng demo",
      exposureRating: Number(cli.exposureRating) || 3,
      vulnerabilityRating: Number(cli.vulnerabilityRating) || 3,
      priorityBand: cli.priorityBand || "medium",
      ratingRationale: cli.ratingRationale || "Đánh giá tự động",
      screeningStatus: "completed",
      inputSha256: "sc2".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newCli, ...list];
    setCached("supplier_climate", updated);
    return newCli;
  },

  getCarbonSnapshots(): CarbonCriticalitySnapshot[] {
    return getCached("carbon_snapshots", () => [
      {
        id: "demo-csnap-1",
        subjectKind: "supplier",
        supplierRevisionId: "demo-sup-1",
        supplierName: "Công ty Cung ứng Sợi Việt",
        reportingPeriodStart: "2026-01-01",
        reportingPeriodEnd: "2026-06-30",
        grossKgCo2e: 450000,
        activityQuantity: 100000,
        activityUnit: "kg sợi",
        intensityKgCo2e: 4.5,
        boundary: "Cradle-to-Gate",
        methodologyReference: "GHG Protocol Scope 3 Cat 1",
        sourceKind: "supplier_specific",
        dataQualityLevel: "L2",
        carbonSha256: "cs1".repeat(32),
        createdAt: "2026-07-05T00:00:00Z",
      },
    ]);
  },
  addCarbonSnapshot(snap: Partial<CarbonCriticalitySnapshot>): CarbonCriticalitySnapshot {
    const list = this.getCarbonSnapshots();
    const newSnap: CarbonCriticalitySnapshot = {
      id: `demo-csnap-${Date.now()}`,
      subjectKind: snap.subjectKind || "supplier",
      supplierRevisionId: snap.supplierRevisionId || null,
      facilityRevisionId: snap.facilityRevisionId || null,
      reportingPeriodStart: snap.reportingPeriodStart || "2026-01-01",
      reportingPeriodEnd: snap.reportingPeriodEnd || "2026-12-31",
      grossKgCo2e: Number(snap.grossKgCo2e) || 100000,
      activityQuantity: Number(snap.activityQuantity) || 20000,
      activityUnit: snap.activityUnit || "kg",
      intensityKgCo2e: Number(snap.intensityKgCo2e) || 5.0,
      boundary: snap.boundary || "Cradle-to-Gate",
      methodologyReference: snap.methodologyReference || "GHG Protocol Scope 3",
      sourceKind: snap.sourceKind || "supplier_specific",
      dataQualityLevel: snap.dataQualityLevel || "L2",
      carbonSha256: "cs2".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newSnap, ...list];
    setCached("carbon_snapshots", updated);
    return newSnap;
  },

  getCriticalityModels(): CriticalityModel[] {
    return getCached("criticality_models", () => [
      {
        id: "demo-model-1",
        modelReference: "CRIT-MODEL-DEFAULT",
        revision: 1,
        carbonWeightPercent: 35,
        climateWeightPercent: 35,
        dependencyWeightPercent: 30,
        mediumThreshold: 40,
        highThreshold: 70,
        normalizationPolicy: "min_max",
        rationale: "Default multi-criteria criticality weighting model",
        approvalStatus: "approved",
        modelSha256: "m1".repeat(32),
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]);
  },
  addCriticalityModel(model: Partial<CriticalityModel>): CriticalityModel {
    const list = this.getCriticalityModels();
    const newModel: CriticalityModel = {
      id: `demo-model-${Date.now()}`,
      modelReference: model.modelReference || `MODEL-${Date.now().toString().slice(-4)}`,
      revision: 1,
      carbonWeightPercent: Number(model.carbonWeightPercent) || 35,
      climateWeightPercent: Number(model.climateWeightPercent) || 35,
      dependencyWeightPercent: Number(model.dependencyWeightPercent) || 30,
      mediumThreshold: Number(model.mediumThreshold) || 40,
      highThreshold: Number(model.highThreshold) || 70,
      normalizationPolicy: model.normalizationPolicy || "min_max",
      rationale: model.rationale || "Mô hình trọng số demo",
      approvalStatus: model.approvalStatus || "approved",
      modelSha256: "m2".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newModel, ...list];
    setCached("criticality_models", updated);
    return newModel;
  },

  getCriticalitySnapshots(): CriticalitySnapshot[] {
    return getCached("criticality_snapshots", () => [
      {
        id: "demo-crit-1",
        subjectKind: "supplier",
        supplierRevisionId: "demo-sup-1",
        supplierName: "Công ty Cung ứng Sợi Việt",
        relationshipRevisionId: "demo-rel-1",
        carbonSnapshotId: "demo-csnap-1",
        modelRevisionId: "demo-model-1",
        modelReference: "CRIT-MODEL-DEFAULT",
        assessmentPeriodStart: "2026-01-01",
        assessmentPeriodEnd: "2026-12-31",
        normalizedCarbonScore: 68,
        normalizedClimateScore: 55,
        normalizedDependencyScore: 72,
        weightedScore: 64.6,
        priorityBand: "medium",
        reviewStatus: "approved",
        inputSnapshot: {},
        inputSha256: "cr1".repeat(32),
        createdAt: "2026-02-10T00:00:00Z",
      },
    ]);
  },
  addCriticalitySnapshot(crit: Partial<CriticalitySnapshot>): CriticalitySnapshot {
    const list = this.getCriticalitySnapshots();
    const carb = Number(crit.normalizedCarbonScore) || 50;
    const clim = Number(crit.normalizedClimateScore) || 50;
    const dep = Number(crit.normalizedDependencyScore) || 50;
    const weighted = Number((carb * 0.35 + clim * 0.35 + dep * 0.3).toFixed(1));
    const newCrit: CriticalitySnapshot = {
      id: `demo-crit-${Date.now()}`,
      subjectKind: crit.subjectKind || "supplier",
      supplierRevisionId: crit.supplierRevisionId || null,
      facilityRevisionId: crit.facilityRevisionId || null,
      relationshipRevisionId: crit.relationshipRevisionId || null,
      carbonSnapshotId: crit.carbonSnapshotId || "demo-csnap-1",
      modelRevisionId: crit.modelRevisionId || "demo-model-1",
      assessmentPeriodStart: crit.assessmentPeriodStart || "2026-01-01",
      assessmentPeriodEnd: crit.assessmentPeriodEnd || "2026-12-31",
      normalizedCarbonScore: carb,
      normalizedClimateScore: clim,
      normalizedDependencyScore: dep,
      weightedScore: weighted,
      priorityBand: weighted >= 70 ? "high" : weighted >= 40 ? "medium" : "low",
      reviewStatus: "approved",
      inputSnapshot: {},
      inputSha256: "cr2".repeat(32),
      createdAt: new Date().toISOString(),
    };
    const updated = [newCrit, ...list];
    setCached("criticality_snapshots", updated);
    return newCrit;
  },

  getCriticalityPortfolios(): CriticalityPortfolio[] {
    return getCached("criticality_portfolios", () => [
      {
        id: "demo-port-1",
        portfolioReference: "PORT-SUPPLY-CHAIN-2026",
        modelRevisionId: "demo-model-1",
        assessmentPeriodStart: "2026-01-01",
        assessmentPeriodEnd: "2026-12-31",
        subjectCount: 2,
        prioritySummary: {
          countByPriority: { low: 0, medium: 2, high: 0 },
          averageWeightedScore: 64.6,
          reviewStatus: "approved",
        },
        coverageSummary: {
          method: "multi_criteria",
          subjectCount: 2,
          facilityCount: 1,
          supplierCount: 2,
          supplierSpecificCarbonCount: 1,
          completeThreeHazardCount: 1,
          supplierDependencyRecordCount: 1,
          singleSourceSupplierCount: 0,
          selectedSupplierSpendPercent: 78.5,
        },
        methodologyNotes: "Danh mục xếp hạng mức độ trọng yếu chuỗi cung ứng theo GHG Protocol Scope 3 và TCFD",
        inputSha256: "p1".repeat(32),
        createdAt: "2026-02-12T00:00:00Z",
        members: this.getCriticalitySnapshots(),
      },
    ]);
  },
  addCriticalityPortfolio(port: {
    portfolioReference: string;
    methodologyNotes?: string;
    criticalitySnapshotIds?: string[];
    assessmentIds?: string[];
  }): CriticalityPortfolio {
    const list = this.getCriticalityPortfolios();
    const ids = port.criticalitySnapshotIds || port.assessmentIds || [];
    const snapshots = this.getCriticalitySnapshots();
    const members = snapshots.filter((s) => ids.includes(s.id));
    const avgScore = members.length > 0 ? members.reduce((acc, m) => acc + m.weightedScore, 0) / members.length : 60;
    const newPort: CriticalityPortfolio = {
      id: `demo-port-${Date.now()}`,
      portfolioReference: port.portfolioReference || `PORT-${Date.now().toString().slice(-4)}`,
      modelRevisionId: "demo-model-1",
      assessmentPeriodStart: "2026-01-01",
      assessmentPeriodEnd: "2026-12-31",
      subjectCount: members.length || 1,
      prioritySummary: {
        countByPriority: {
          low: members.filter((m) => m.priorityBand === "low").length,
          medium: members.filter((m) => m.priorityBand === "medium").length,
          high: members.filter((m) => m.priorityBand === "high").length,
        },
        averageWeightedScore: Number(avgScore.toFixed(1)),
        reviewStatus: "approved",
      },
      coverageSummary: {
        method: "multi_criteria",
        subjectCount: members.length,
        facilityCount: 1,
        supplierCount: members.length,
        supplierSpecificCarbonCount: members.length,
        completeThreeHazardCount: 1,
        supplierDependencyRecordCount: members.length,
        singleSourceSupplierCount: 0,
        selectedSupplierSpendPercent: 85,
      },
      methodologyNotes: port.methodologyNotes || "Phương pháp xếp hạng danh mục",
      inputSha256: "p2".repeat(32),
      createdAt: new Date().toISOString(),
      members,
    };
    const updated = [newPort, ...list];
    setCached("criticality_portfolios", updated);
    return newPort;
  },

  // 10. Climate Risk (Locations, Assessments, Portfolios)
  getClimateLocations(): ClimateLocation[] {
    return getCached("climate_locations", () => [
      {
        id: "demo-loc-1",
        facilityRevisionId: INDUSTRIAL_DEMO.facilities[0].id,
        facilityName: INDUSTRIAL_DEMO.facilities[0].name,
        latitude: 10.8231,
        longitude: 106.6297,
        precisionMeters: 50,
        locationBasis: "Trích lục bản đồ địa chính KCN Tân Bình, TP.HCM",
        evidenceSnapshot: { id: "demo-ev-loc-1", checksumSha256: "l1".repeat(32) },
        createdAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "demo-loc-2",
        facilityRevisionId: INDUSTRIAL_DEMO.facilities[1]?.id || "demo-fac-2",
        facilityName: INDUSTRIAL_DEMO.facilities[1]?.name || "Xưởng Nhuộm & Hoàn tất Sóng Thần",
        latitude: 10.9025,
        longitude: 106.7456,
        precisionMeters: 25,
        locationBasis: "Tọa độ GPS ranh giới nhà máy KCN Sóng Thần 2, Bình Dương",
        evidenceSnapshot: { id: "demo-ev-loc-2", checksumSha256: "l2".repeat(32) },
        createdAt: "2026-01-15T00:00:00Z",
      },
    ]);
  },
  addClimateLocation(loc: Partial<ClimateLocation>): ClimateLocation {
    const list = this.getClimateLocations();
    const facilityName = INDUSTRIAL_DEMO.facilities.find((f) => f.id === loc.facilityRevisionId)?.name || "Cơ sở sản xuất";
    const newLoc: ClimateLocation = {
      id: `demo-loc-${Date.now()}`,
      facilityRevisionId: loc.facilityRevisionId || INDUSTRIAL_DEMO.facilities[0].id,
      facilityName,
      latitude: Number(loc.latitude) || 10.823,
      longitude: Number(loc.longitude) || 106.629,
      precisionMeters: Number(loc.precisionMeters) || 50,
      locationBasis: loc.locationBasis || "Đo đạc thực địa",
      evidenceSnapshot: { id: "demo-ev-loc-auto", checksumSha256: "l3".repeat(32) },
      createdAt: new Date().toISOString(),
    };
    const updated = [newLoc, ...list];
    setCached("climate_locations", updated);
    return newLoc;
  },

  getClimateAssessments(): ClimateAssessment[] {
    return getCached("climate_assessments", () => [
      {
        id: "demo-cass-1",
        facilityRevisionId: INDUSTRIAL_DEMO.facilities[0].id,
        facilityName: INDUSTRIAL_DEMO.facilities[0].name,
        locationRevisionId: "demo-loc-1",
        hazardType: "heat",
        scenarioKind: "historical",
        scenarioReference: "ERA5-LAND-1991-2020",
        horizonStart: "1991",
        horizonEnd: "2020",
        sourceKind: "ERA5_LAND",
        sourceUrl: "https://cds.climate.copernicus.eu",
        datasetIdentifier: "reanalysis-era5-land",
        datasetVersion: "v1",
        spatialResolution: "0.1 deg (~9km)",
        temporalResolution: "hourly",
        gridReference: "GRID-HCM-10.8-106.6",
        spatialMatchNotes: "Nội suy song tuyến tính điểm tọa độ nhà máy",
        hazardMetric: "Số ngày nắng nóng cực đoan (Tx > 35°C)",
        metricValue: 48,
        metricUnit: "ngày/năm",
        uncertaintyNotes: "Độ tin cậy reanalysis ECMWF cao",
        exposureRating: 4,
        vulnerabilityRating: 3,
        businessDependencyPercent: 60,
        priorityBand: "medium",
        ratingRationale: "Ảnh hưởng hiệu suất lao động xưởng may và điều hòa không khí",
        screeningStatus: "completed",
        evidenceSnapshot: { id: "demo-ev-c1", checksumSha256: "a1".repeat(32) },
        createdAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "demo-cass-2",
        facilityRevisionId: INDUSTRIAL_DEMO.facilities[0].id,
        facilityName: INDUSTRIAL_DEMO.facilities[0].name,
        locationRevisionId: "demo-loc-1",
        hazardType: "extreme_rainfall",
        scenarioKind: "projection",
        scenarioReference: "CMIP6-SSP2-4.5-2040",
        horizonStart: "2026",
        horizonEnd: "2040",
        sourceKind: "CMIP6",
        sourceUrl: "https://esgf-node.llnl.gov",
        datasetIdentifier: "cmip6-precipitation-projection",
        datasetVersion: "v2.1",
        spatialResolution: "0.25 deg",
        temporalResolution: "daily",
        gridReference: "GRID-SGN-RAINFALL-01",
        spatialMatchNotes: "Ghép lưới lưu vực sông Sài Gòn - Đồng Nai",
        modelName: "EC-Earth3",
        scenarioName: "SSP2-4.5",
        hazardMetric: "Lượng mưa cực đoan ngày lớn nhất (Rx1day)",
        metricValue: 245,
        metricUnit: "mm/ngày",
        uncertaintyNotes: "Khoảng biến thiên mô hình CMIP6 ±15%",
        exposureRating: 4,
        vulnerabilityRating: 4,
        businessDependencyPercent: 60,
        priorityBand: "high",
        ratingRationale: "Nguy cơ ngập cục bộ kho thành phẩm vải may mặc khi triều cường kết hợp mưa lớn",
        screeningStatus: "completed",
        evidenceSnapshot: { id: "demo-ev-c2", checksumSha256: "a2".repeat(32) },
        createdAt: "2026-02-05T00:00:00Z",
      },
      {
        id: "demo-cass-3",
        facilityRevisionId: INDUSTRIAL_DEMO.facilities[0].id,
        facilityName: INDUSTRIAL_DEMO.facilities[0].name,
        locationRevisionId: "demo-loc-1",
        hazardType: "drought",
        scenarioKind: "projection",
        scenarioReference: "CMIP6-SSP2-4.5-2040",
        horizonStart: "2026",
        horizonEnd: "2040",
        sourceKind: "CMIP6",
        sourceUrl: "https://esgf-node.llnl.gov",
        datasetIdentifier: "cmip6-dry-days",
        datasetVersion: "v1.2",
        spatialResolution: "0.25 deg",
        temporalResolution: "daily",
        gridReference: "GRID-SGN-DROUGHT-01",
        spatialMatchNotes: "Chuỗi ngày khô hạn liên tục (CDD)",
        modelName: "MPI-ESM1-2-HR",
        scenarioName: "SSP2-4.5",
        hazardMetric: "Số ngày khô hạn liên tục lớn nhất (CDD)",
        metricValue: 56,
        metricUnit: "ngày",
        uncertaintyNotes: "Mô hình thủy văn hạ lưu sông Đồng Nai",
        exposureRating: 3,
        vulnerabilityRating: 3,
        businessDependencyPercent: 60,
        priorityBand: "medium",
        ratingRationale: "Nguy cơ áp lực cấp nước công nghiệp trong mùa khô",
        screeningStatus: "completed",
        evidenceSnapshot: { id: "demo-ev-c3", checksumSha256: "a3".repeat(32) },
        createdAt: "2026-02-08T00:00:00Z",
      },
    ]);
  },
  addClimateAssessment(ass: Partial<ClimateAssessment>): ClimateAssessment {
    const list = this.getClimateAssessments();
    const facilityName = INDUSTRIAL_DEMO.facilities.find((f) => f.id === ass.facilityRevisionId)?.name || "Cơ sở sản xuất";
    const exp = Number(ass.exposureRating) || 3;
    const vuln = Number(ass.vulnerabilityRating) || 3;
    const newAss: ClimateAssessment = {
      id: `demo-cass-${Date.now()}`,
      facilityRevisionId: ass.facilityRevisionId || INDUSTRIAL_DEMO.facilities[0].id,
      facilityName,
      locationRevisionId: ass.locationRevisionId || "demo-loc-1",
      hazardType: ass.hazardType || "heat",
      scenarioKind: ass.scenarioKind || "projection",
      scenarioReference: ass.scenarioReference || "CMIP6-SSP2-4.5",
      horizonStart: ass.horizonStart || "2026",
      horizonEnd: ass.horizonEnd || "2035",
      sourceKind: ass.sourceKind || "CMIP6",
      sourceUrl: ass.sourceUrl || "https://cds.climate.copernicus.eu",
      datasetIdentifier: ass.datasetIdentifier || "cmip6-data",
      datasetVersion: ass.datasetVersion || "v1",
      spatialResolution: ass.spatialResolution || "0.25 deg",
      temporalResolution: ass.temporalResolution || "daily",
      gridReference: ass.gridReference || "GRID-VN-AUTO",
      spatialMatchNotes: ass.spatialMatchNotes || "Ghép tọa độ cơ sở",
      hazardMetric: ass.hazardMetric || "Chỉ tiêu hiểm họa",
      metricValue: Number(ass.metricValue) || 50,
      metricUnit: ass.metricUnit || "đơn vị",
      uncertaintyNotes: ass.uncertaintyNotes || "Dữ liệu mô phỏng demo",
      exposureRating: exp,
      vulnerabilityRating: vuln,
      businessDependencyPercent: Number(ass.businessDependencyPercent) || 50,
      priorityBand: ass.priorityBand || (exp >= 4 && vuln >= 4 ? "high" : exp >= 3 ? "medium" : "low"),
      ratingRationale: ass.ratingRationale || "Đánh giá hiểm họa cơ sở",
      screeningStatus: "completed",
      evidenceSnapshot: { id: "demo-ev-cass-auto", checksumSha256: "a4".repeat(32) },
      createdAt: new Date().toISOString(),
    };
    const updated = [newAss, ...list];
    setCached("climate_assessments", updated);
    return newAss;
  },

  getClimatePortfolios(): ClimatePortfolio[] {
    return getCached("climate_portfolios", () => [
      {
        id: "demo-cport-1",
        portfolioReference: "PORT-CLIMATE-RISK-2026",
        scenarioKind: "projection",
        scenarioReference: "CMIP6-SSP2-4.5-2040",
        horizonStart: "2026",
        horizonEnd: "2040",
        facilityCount: 1,
        assessmentCount: 3,
        prioritySummary: {
          reviewStatus: "approved",
          facilityCountByPriority: { low: 0, medium: 1, high: 0 },
          dependencyPercentByPriority: { low: 0, medium: 60, high: 0 },
          incompleteHazardCoverageFacilities: 0,
        },
        methodologyNotes: "Sàng lọc rủi ro khí hậu vật lý tuân thủ khuyến nghị TCFD và chuẩn mực công bố IFRS S2",
        createdAt: "2026-02-15T00:00:00Z",
      },
    ]);
  },
  addClimatePortfolio(port: { portfolioReference: string; methodologyNotes?: string; assessmentIds: string[] }): ClimatePortfolio {
    const list = this.getClimatePortfolios();
    const assessments = this.getClimateAssessments().filter((a) => port.assessmentIds.includes(a.id));
    const newPort: ClimatePortfolio = {
      id: `demo-cport-${Date.now()}`,
      portfolioReference: port.portfolioReference || `PORT-CLIM-${Date.now().toString().slice(-4)}`,
      scenarioKind: "projection",
      scenarioReference: "CMIP6-SSP2-4.5",
      horizonStart: "2026",
      horizonEnd: "2040",
      facilityCount: 1,
      assessmentCount: assessments.length || 1,
      prioritySummary: {
        reviewStatus: "approved",
        facilityCountByPriority: {
          low: assessments.filter((a) => a.priorityBand === "low").length,
          medium: assessments.filter((a) => a.priorityBand === "medium").length,
          high: assessments.filter((a) => a.priorityBand === "high").length,
        },
        dependencyPercentByPriority: { low: 0, medium: 60, high: 0 },
        incompleteHazardCoverageFacilities: 0,
      },
      methodologyNotes: port.methodologyNotes || "Sàng lọc danh mục khí hậu",
      createdAt: new Date().toISOString(),
    };
    const updated = [newPort, ...list];
    setCached("climate_portfolios", updated);
    return newPort;
  },

  // 10. Data Gaps Checklist (Audit Readiness)
  getDataGaps(): Array<{
    id: string;
    dataGroup: string;
    requiredForAudit: boolean;
    currentStatus: "missing" | "proxy" | "self_declared" | "uploaded" | "verified";
    riskLevel: "low" | "medium" | "high";
    requiredAction: string | null;
    owner: string | null;
    deadline: string | null;
    regulationTag?: string;
  }> {
    return getCached("data_gaps", () => [
      {
        id: "demo-gap-1",
        dataGroup: "Dyeing supplier energy data (Scope 3 Category 1)",
        requiredForAudit: true,
        currentStatus: "missing",
        riskLevel: "high",
        requiredAction: "Yêu cầu nhà máy nhuộm gửi dữ liệu tiêu thụ điện và hơi thực tế",
        owner: "Trưởng phòng Mua hàng",
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        regulationTag: "GHG Protocol Scope 3",
      },
      {
        id: "demo-gap-2",
        dataGroup: "Diesel & thermal boiler process evidence",
        requiredForAudit: true,
        currentStatus: "proxy",
        riskLevel: "high",
        requiredAction: "Gắn hóa đơn mua dầu diesel và chứng từ cân sinh khối Q3",
        owner: "Kỹ sư vận hành lò hơi",
        deadline: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
        regulationTag: "Quyết định 13/2024/QĐ-TTg",
      },
      {
        id: "demo-gap-3",
        dataGroup: "Sea freight document & Bill of Lading (LOT-EU-2026-001)",
        requiredForAudit: true,
        currentStatus: "uploaded",
        riskLevel: "medium",
        requiredAction: "Đã liên kết vận đơn đường biển MSC với mã SHA-256",
        owner: "Bộ phận Logistics",
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        regulationTag: "EU CBAM Clause 7",
      },
      {
        id: "demo-gap-4",
        dataGroup: "BOM and main electricity invoice (EVN)",
        requiredForAudit: true,
        currentStatus: "verified",
        riskLevel: "low",
        requiredAction: "Đã khóa chứng từ và đối soát chỉ số công tơ điện tử",
        owner: "Kế toán chi phí",
        deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
        regulationTag: "ISO 14064-1:2018",
      },
      {
        id: "demo-gap-5",
        dataGroup: "GOTS certification for organic cotton lot 2026",
        requiredForAudit: true,
        currentStatus: "uploaded",
        riskLevel: "medium",
        requiredAction: "Kiểm tra thời hạn chứng nhận GOTS trên cổng Control Union",
        owner: "Phòng QA/QC",
        deadline: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10),
        regulationTag: "EU Textile Strategy",
      },
      {
        id: "demo-gap-6",
        dataGroup: "Scope 1 fuel emission factor verification (MoNRE)",
        requiredForAudit: true,
        currentStatus: "verified",
        riskLevel: "low",
        requiredAction: "Hệ số phát thải đã đối chiếu theo văn bản Cục Biến đổi khí hậu",
        owner: "Chuyên viên ESG",
        deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
        regulationTag: "Nghị định 06/2022/NĐ-CP",
      },
    ]);
  },
  addDataGap(gap: {
    dataGroup: string;
    requiredForAudit?: boolean;
    currentStatus?: "missing" | "proxy" | "self_declared" | "uploaded" | "verified";
    riskLevel?: "low" | "medium" | "high";
    requiredAction?: string | null;
    owner?: string | null;
    deadline?: string | null;
    regulationTag?: string;
  }) {
    const list = this.getDataGaps();
    const newGap = {
      id: `demo-gap-${Date.now()}`,
      dataGroup: gap.dataGroup,
      requiredForAudit: gap.requiredForAudit ?? true,
      currentStatus: gap.currentStatus || "missing",
      riskLevel: gap.riskLevel || "high",
      requiredAction: gap.requiredAction || null,
      owner: gap.owner || null,
      deadline: gap.deadline || null,
      regulationTag: gap.regulationTag || "Kiểm toán nội bộ",
    };
    const updated = [newGap, ...list];
    setCached("data_gaps", updated);
    return newGap;
  },
  updateDataGap(
    id: string,
    updates: Partial<{
      dataGroup: string;
      currentStatus: "missing" | "proxy" | "self_declared" | "uploaded" | "verified";
      riskLevel: "low" | "medium" | "high";
      requiredAction: string | null;
      owner: string | null;
      deadline: string | null;
      regulationTag?: string;
    }>
  ) {
    const list = this.getDataGaps().map((g) => (g.id === id ? { ...g, ...updates } : g));
    setCached("data_gaps", list);
    return list.find((g) => g.id === id);
  },
  deleteDataGap(id: string) {
    const list = this.getDataGaps().filter((g) => g.id !== id);
    setCached("data_gaps", list);
  },
  seedDataGaps(groups: string[]) {
    const list = this.getDataGaps();
    const existing = new Set(list.map((g) => g.dataGroup));
    const newItems = groups
      .filter((g) => !existing.has(g))
      .map((g, idx) => ({
        id: `demo-gap-seed-${Date.now()}-${idx}`,
        dataGroup: g,
        requiredForAudit: true,
        currentStatus: "missing" as const,
        riskLevel: "high" as const,
        requiredAction: "Thu thập chứng từ gốc hoặc biên bản đối soát",
        owner: "Chuyên viên dữ liệu",
        deadline: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        regulationTag: "Checklist mặc định",
      }));
    const updated = [...newItems, ...list];
    setCached("data_gaps", updated);
    return updated;
  },

  // 11. Inbox Tasks & Statuses
  getInboxTasks(): Array<{
    id: string;
    category: "evidence" | "factor" | "quality" | "calibration" | "compliance";
    priority: "critical" | "high" | "medium" | "low";
    title: string;
    reason: string;
    path: string;
    status: "pending" | "in_progress" | "resolved";
    deadline?: string;
    aiRecommendation?: string;
  }> {
    return getCached("inbox_tasks", () => [
      {
        id: "task-demo-1",
        category: "evidence",
        priority: "critical",
        title: "Bổ sung hóa đơn điện EVN tháng 06/2026",
        reason: "Hoạt động ACT-ELEC-SGN01 sản lượng 145,200 kWh chưa có chứng từ hóa đơn khóa SHA-256.",
        path: "/activity-data",
        status: "pending",
        deadline: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
        aiRecommendation: "Quét hóa đơn EVN định dạng PDF hoặc nhập số công tơ để tự động gán SHA-256.",
      },
      {
        id: "task-demo-2",
        category: "factor",
        priority: "high",
        title: "Phê duyệt hệ số phát thải Biomass trấu ép",
        reason: "Đề xuất hệ số F-BIO-02 (0.015 kgCO2e/kg) đang chờ review của Trưởng nhóm ESG.",
        path: "/data-quality",
        status: "pending",
        deadline: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10),
        aiRecommendation: "Đối chiếu tài liệu kiểm định nhiệt lượng than sinh khối và ban hành trạng thái Approved.",
      },
      {
        id: "task-demo-3",
        category: "calibration",
        priority: "medium",
        title: "Hiệu chuẩn đồng hồ đo lưu lượng khí lò hơi #2",
        reason: "Cảm biến NODE-EM-02 đã đến hạn kiểm định định kỳ theo quy định của Trung tâm Đo lường.",
        path: "/connected-data",
        status: "pending",
        deadline: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10),
        aiRecommendation: "Lên lịch với Quatest hoặc đơn vị được chỉ định; cập nhật chứng chỉ hiệu chuẩn mới.",
      },
      {
        id: "task-demo-4",
        category: "compliance",
        priority: "critical",
        title: "Nộp báo cáo kiểm kê KNK đợt 1 theo Quyết định 13/2024",
        reason: "Thời hạn rà soát kế hoạch giảm nhẹ cấp cơ sở dệt may cho cơ quan quản lý địa phương.",
        path: "/vietnam-carbon",
        status: "in_progress",
        deadline: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10),
        aiRecommendation: "Chạy chức năng rà soát tự động VN-MRV để xuất bảng tổng hợp mẫu số 01/KNK.",
      },
      {
        id: "task-demo-5",
        category: "quality",
        priority: "medium",
        title: "Nâng hạng DQL cho phát thải chuỗi cung ứng sợi bông",
        reason: "75% dữ liệu Scope 3 đang dùng hệ số mặc định toàn cầu IPCC Tier 1 (DQL L1).",
        path: "/data-quality",
        status: "pending",
        deadline: new Date(Date.now() + 25 * 86400000).toISOString().slice(0, 10),
        aiRecommendation: "Gửi biểu mẫu thu thập dữ liệu sơ cấp cho nhà cung ứng cấp 1 để nâng lên Tier 2.",
      },
    ]);
  },
  updateInboxTaskStatus(id: string, status: "pending" | "in_progress" | "resolved") {
    const list = this.getInboxTasks().map((t) => (t.id === id ? { ...t, status } : t));
    setCached("inbox_tasks", list);
    return list.find((t) => t.id === id);
  },
};
