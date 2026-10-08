// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  access: { isRoot: true, canMutate: true },
  core: { facilities: vi.fn(), processes: vi.fn(), createFacility: vi.fn(), createProcess: vi.fn(), activities: vi.fn(), activityLineage: vi.fn(), reviewActivity: vi.fn() },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "a", company_id: "company-a" } }) }));
vi.mock("@/contexts/DashboardContext", () => ({ useDashboardTitle: () => ({ setPageTitle: () => {} }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => mocks.access }));
vi.mock("@/lib/demo/routes", () => ({ useAppRoutes: () => ({ toAppPath: (path: string) => path }) }));
vi.mock("@/lib/industrialCoreApi", () => ({ industrialCoreApi: mocks.core }));
import FacilityProcessClient from "./FacilityProcessClient";
import EvidenceLineageClient from "./EvidenceLineageClient";
import ActivityDataClient from "./ActivityDataClient";
import { WORKSPACE_DEMO } from "@/lib/dashboard/industrialWorkspace";
beforeEach(() => {
  vi.stubGlobal("React", React); vi.clearAllMocks(); mocks.access = { isRoot: true, canMutate: true };
  mocks.core.facilities.mockResolvedValue(WORKSPACE_DEMO.facilities);
  mocks.core.activities.mockResolvedValue(WORKSPACE_DEMO.activities);
  mocks.core.activityLineage.mockResolvedValue({ activity: WORKSPACE_DEMO.activities[0], facility: { name: "Factory", reference: "F" }, process: null, measurementPoint: null, evidence: [], latestReview: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("new workspace user flows", () => {
  it("uses isolated activity demo rendering without calling unsupported real lineage APIs", async () => {
    render(<ActivityDataClient demo />);
    await screen.findByText("DEMO-ELECTRICITY");
    expect(screen.getAllByRole("link", { name: "Xem chuỗi bằng chứng minh họa →" })).toHaveLength(5);
    expect(mocks.core.activities).not.toHaveBeenCalled();
    expect(mocks.core.activityLineage).not.toHaveBeenCalled();
  });
  it.each([{ isRoot: false, canMutate: false }, { isRoot: false, canMutate: true }, { isRoot: true, canMutate: false }])("disables facility creation for limited access %j", async access => {
    mocks.access = access;
    render(<FacilityProcessClient mode="facilities" />);
    await waitFor(() => expect(screen.getByLabelText("Mã tham chiếu")).toBeDisabled());
    fireEvent.submit(screen.getByRole("button", { name: "Lưu revision" }).closest("form")!);
    expect(mocks.core.createFacility).not.toHaveBeenCalled();
  });
  it("demo never loads or writes enterprise APIs", async () => {
    render(<FacilityProcessClient mode="facilities" demo />);
    await screen.findByText("Cơ sở minh họa");
    expect(screen.getByLabelText("Mã tham chiếu")).toBeEnabled();
    expect(mocks.core.facilities).not.toHaveBeenCalled();
  });
  it("shows save errors and keeps the submitted form available to correct", async () => {
    mocks.core.createFacility.mockRejectedValue(new Error("409 duplicate revision"));
    render(<FacilityProcessClient mode="facilities" />);
    fireEvent.change(await screen.findByLabelText("Mã tham chiếu"), { target: { value: "F-1" } });
    fireEvent.change(screen.getByLabelText("Tên"), { target: { value: "New facility" } });
    fireEvent.change(screen.getByLabelText("Ranh giới cơ sở"), { target: { value: "Factory boundary" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu revision" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("409 duplicate revision");
    expect(screen.getByLabelText("Tên")).toHaveValue("New facility");
  });
  it("blocks approval without controlled evidence but permits a named information request", async () => {
    mocks.core.reviewActivity.mockResolvedValue({});
    render(<EvidenceLineageClient review />);
    await screen.findByText(/Hoạt động này chưa gắn chứng từ/);
    expect(screen.getByRole("option", { name: "Duyệt bằng chứng đã kiểm soát" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Lý do review"), { target: { value: "Need controlled evidence before approval" } });
    fireEvent.submit(screen.getByRole("button", { name: "Lưu review" }).closest("form")!);
    await waitFor(() => expect(mocks.core.reviewActivity).toHaveBeenCalledWith(WORKSPACE_DEMO.activities[0].id, { reviewerRole: "industrial_activity_reviewer", decision: "needs_information", notes: "Need controlled evidence before approval" }));
  });
});
