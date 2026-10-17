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
