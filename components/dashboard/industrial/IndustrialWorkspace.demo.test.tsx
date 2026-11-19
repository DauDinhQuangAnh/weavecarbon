// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  core: { facilities: vi.fn(), processes: vi.fn(), activities: vi.fn(), measurementPoints: vi.fn(), activityLineage: vi.fn(), capabilities: vi.fn(), createFacility: vi.fn(), createProcess: vi.fn(), reviewActivity: vi.fn() },
  inventories: vi.fn(), evidence: vi.fn(), factors: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "privileged", company_id: "real-company" } }) }));
vi.mock("@/contexts/DashboardContext", () => ({ useDashboardTitle: () => ({ setPageTitle: () => {} }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isRoot: true, canMutate: true }) }));
vi.mock("@/lib/demo/routes", () => ({ useAppRoutes: () => ({ toAppPath: (path: string) => `/demo${path}` }) }));
vi.mock("@/lib/industrialCoreApi", () => ({ industrialCoreApi: apiMocks.core }));
vi.mock("@/lib/weave-v2/corporateGhgInventoryApi", () => ({ fetchCorporateGhgInventories: apiMocks.inventories }));
vi.mock("@/lib/weave-v2/evidenceV2Api", () => ({ listEvidenceV2: apiMocks.evidence }));
vi.mock("@/lib/dataGovernanceApi", () => ({ dataGovernanceApi: { factorProposals: apiMocks.factors } }));

import FacilityProcessClient from "./FacilityProcessClient";
import ActivityDataClient from "./ActivityDataClient";
import CarbonInsightsClient from "./CarbonInsightsClient";
import EvidenceLineageClient from "./EvidenceLineageClient";
import InboxClient from "./InboxClient";
import ComplianceClient from "./ComplianceClient";
import { DEMO_INVENTORIES, INDUSTRIAL_DEMO, demoActivityLineage } from "@/lib/dashboard/industrialDemoData";
import { inventoryHotspots, latestInventoryRevisions } from "@/lib/dashboard/industrialWorkspace";

beforeEach(() => { vi.stubGlobal("React", React); vi.clearAllMocks(); });
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  for (const mock of [...Object.values(apiMocks.core), apiMocks.inventories, apiMocks.evidence, apiMocks.factors]) expect(mock).not.toHaveBeenCalled();
});

describe("new industrial demo pages", () => {
  it.each([
    { page: <FacilityProcessClient mode="facilities" demo />, text: "Xưởng luyện thép lò điện minh họa" },
    { page: <FacilityProcessClient mode="processes" demo />, text: "Luyện thép lò điện minh họa" },
    { page: <ActivityDataClient demo />, text: "DEMO-EAF-FUEL" },
    { page: <CarbonInsightsClient mode="emissions" demo />, text: "Scope 1 · Phát thải trực tiếp" },
    { page: <CarbonInsightsClient mode="hotspots" demo />, text: "Độ bao phủ Top 5 Hotspots" },
    { page: <EvidenceLineageClient demo />, text: "DEMO · Hóa đơn điện tháng 9 · locked" },
    { page: <EvidenceLineageClient review demo />, text: "DEMO · Hóa đơn điện tháng 9 · locked" },
    { page: <InboxClient demo />, text: "DEMO · Hệ số nhiên liệu chờ rà soát" },
    { page: <ComplianceClient demo />, text: "Hai kỳ kiểm kê giả định" },
  ])("renders populated demo pages without per-page demo notices: $text", async ({ page, text }) => {
    render(page);
    expect(await screen.findByText(text)).toBeInTheDocument();
    // Chỉ khung DEMO MODE ở thanh bên báo chế độ demo; các trang không lặp lại ghi chú.
    expect(screen.queryByText(/Demo chỉ đọc|Chế độ Demo/)).not.toBeInTheDocument();
  });

  it("changes inventory periods and hotspot grouping without mixing revisions", async () => {
    render(<CarbonInsightsClient mode="hotspots" demo />);
    const select = await screen.findByRole("combobox", { name: "Chọn inventory" });
    expect(select.querySelectorAll("option")).toHaveLength(2);
    fireEvent.change(screen.getByRole("combobox", { name: "Nhóm hotspot" }), { target: { value: "category" } });
    expect(screen.getByText("Khí thiên nhiên lò thùng")).toBeInTheDocument();
    fireEvent.change(select, { target: { value: DEMO_INVENTORIES[2].id } });
    expect(screen.getByText("7,15 tCO₂e")).toBeInTheDocument();
  });

  it("resolves each selected activity's own lineage and blocks demo writes", async () => {
    render(<EvidenceLineageClient review demo />);
    await screen.findByText("DEMO · Hóa đơn điện tháng 9 · locked");
    const select = screen.getByRole("combobox", { name: /Chọn hoạt động/ });
    fireEvent.change(select, { target: { value: INDUSTRIAL_DEMO.activities[2].id } });
    expect(await screen.findByText("DEMO · Phiếu nhiên liệu chờ review · uploaded")).toBeInTheDocument();
    expect(screen.queryByText("DEMO · Hóa đơn điện tháng 9 · locked")).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: INDUSTRIAL_DEMO.activities[4].id } });
    await screen.findByText("Hoạt động này chưa gắn chứng từ.");
    expect(screen.getByRole("option", { name: "Duyệt bằng chứng đã kiểm soát" })).toBeDisabled();
    expect(screen.getByLabelText("Lý do review")).toBeEnabled();
    fireEvent.submit(screen.getByRole("button", { name: "Lưu review" }).closest("form")!);
  });

  it("filters facilities and inbox entries and keeps links in /demo", async () => {
    const view = render(<FacilityProcessClient mode="facilities" demo />);
    await screen.findByText("Xưởng luyện thép lò điện minh họa");
    fireEvent.change(screen.getByLabelText("Tìm cơ sở hoặc quy trình"), { target: { value: "DEMO-COFFEE" } });
    expect(screen.getByText("Xưởng sơ chế cà phê minh họa")).toBeInTheDocument();
    expect(screen.queryByText("Xưởng luyện thép lò điện minh họa")).not.toBeInTheDocument();
    fireEvent.submit(screen.getByRole("button", { name: "Lưu revision" }).closest("form")!);
    view.unmount();
    render(<InboxClient demo />);
    await screen.findByText("DEMO · Hệ số nhiên liệu chờ rà soát");
    fireEvent.change(screen.getByLabelText("Tìm công việc"), { target: { value: "checksum" } });
    expect(screen.getByRole("link", { name: /Nhật ký sản xuất thiếu checksum/ })).toHaveAttribute("href", "/demo/evidence");
  });

  it("keeps facility/process/evidence links valid and reconciles inventory totals", () => {
    for (const activity of INDUSTRIAL_DEMO.activities) {
      const lineage = demoActivityLineage(activity.id)!;
      expect(lineage.facility.id).toBe(activity.facilityRevisionId);
      expect(lineage.process?.id).toBe(activity.processRevisionId);
      expect(lineage.evidence.map(row => row.id)).toEqual(activity.evidenceDocumentIds);
    }
    expect(demoActivityLineage("unknown")).toBeNull();
    for (const inventory of latestInventoryRevisions(DEMO_INVENTORIES)) {
      const totals = inventory.result.totals;
      expect(inventoryHotspots(inventory, "facility").totalKg).toBeCloseTo(totals.scope1KgCo2e + totals.scope2LocationBasedKgCo2e + (totals.scope3KgCo2e || 0));
      expect(totals.scope2MarketBasedKgCo2e).toBeNull();
    }
  });
});
