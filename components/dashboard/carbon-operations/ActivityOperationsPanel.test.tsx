// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { coreApi, toastMock, hashMock } = vi.hoisted(() => ({
  coreApi: { createActivity: vi.fn(), activityLineage: vi.fn(), reviewActivity: vi.fn() },
  toastMock: vi.fn(),
  hashMock: vi.fn(),
}));

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/hooks/useToast", () => ({ toast: toastMock }));
vi.mock("@/lib/industrialCoreApi", () => ({ industrialCoreApi: coreApi }));
vi.mock("@/lib/industrialOperations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/industrialOperations")>();
  return { ...actual, sha256CanonicalJson: hashMock };
});
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

import ActivityOperationsPanel from "./ActivityOperationsPanel";

const facility = {
  id: "30000000-0000-4000-8000-000000000001", facilityReference: "FAC-1", revision: 1,
  name: "Plant One", countryCode: "VN", timezone: "Asia/Ho_Chi_Minh", lifecycleStatus: "active" as const,
  boundaryNotes: null, metadata: {}, createdAt: "2026-09-26T00:00:00.000Z",
};
const activity = {
  id: "50000000-0000-4000-8000-000000000001", activityReference: "ACT-1", facilityRevisionId: facility.id,
  facilityReference: "FAC-1", facilityName: "Plant One", activityType: "electricity",
  periodStart: "2026-09-01T00:00:00.000Z", periodEnd: "2026-09-30T00:00:00.000Z",
  quantity: 100, canonicalUnit: "kWh", sourceKind: "manual", dataQualityLevel: "L3" as const,
  sourceSha256: "a".repeat(64),
};
const evidence = {
  id: "60000000-0000-4000-8000-000000000001", companyId: "company-1", evidenceType: "meter_export",
  documentName: "meter.pdf", fileSizeBytes: 42, checksumSha256: "b".repeat(64), extractedJson: {}, status: "locked",
  createdAt: "2026-09-26T00:00:00.000Z", updatedAt: "2026-09-26T00:00:00.000Z",
};

describe("ActivityOperationsPanel", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    hashMock.mockResolvedValue("c".repeat(64));
    coreApi.createActivity.mockResolvedValue(activity);
    coreApi.reviewActivity.mockResolvedValue({ id: "review-1" });
    coreApi.activityLineage.mockResolvedValue({
      activity, facility: { id: facility.id, reference: "FAC-1", name: "Plant One" }, process: null,
      measurementPoint: null, evidence: [{ id: evidence.id, name: evidence.documentName, type: evidence.evidenceType, status: evidence.status, checksumSha256: evidence.checksumSha256 }], latestReview: null,
    });
  });

  it("creates a provenance-hashed activity and reports it to the parent", async () => {
    const onCreated = vi.fn();
    const { container } = render(<ActivityOperationsPanel activities={[]} facilities={[facility]} processes={[]} measurementPoints={[]} evidence={[evidence]} canWrite readOnlyMessage="readonly" onCreated={onCreated} />);
    fireEvent.change(screen.getByLabelText("fields.facility"), { target: { value: facility.id } });
    fireEvent.change(screen.getByPlaceholderText("activityReference"), { target: { value: "ACT-1" } });
    fireEvent.change(screen.getByPlaceholderText("quantity"), { target: { value: "100" } });
    const periodInputs = container.querySelectorAll('input[type="datetime-local"]');
    fireEvent.change(periodInputs[0], { target: { value: "2026-09-01T00:00" } });
    fireEvent.change(periodInputs[1], { target: { value: "2026-09-30T23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "createActivity" }));
    await waitFor(() => expect(coreApi.createActivity).toHaveBeenCalledWith(expect.objectContaining({ activityReference: "ACT-1", sourceSha256: "c".repeat(64) })));
    expect(onCreated).toHaveBeenCalledWith(activity);
  });

  it("renders governed lineage and submits a named activity review", async () => {
    render(<ActivityOperationsPanel activities={[activity]} facilities={[facility]} processes={[]} measurementPoints={[]} evidence={[evidence]} canWrite readOnlyMessage="readonly" onCreated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "viewLineage" }));
    expect((await screen.findAllByText("meter.pdf")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("reviewDecision"), { target: { value: "approved" } });
    fireEvent.change(screen.getByPlaceholderText("reviewNotes"), { target: { value: "Đã kiểm tra chứng từ nguồn." } });
    fireEvent.click(screen.getByRole("button", { name: "saveReview" }));
    await waitFor(() => expect(coreApi.reviewActivity).toHaveBeenCalledWith(activity.id, {
      reviewerRole: "industrial_activity_reviewer", decision: "approved", notes: "Đã kiểm tra chứng từ nguồn.",
    }));
  });

  it("keeps all mutation controls disabled in read-only mode", () => {
    render(<ActivityOperationsPanel activities={[]} facilities={[facility]} processes={[]} measurementPoints={[]} evidence={[]} canWrite={false} readOnlyMessage="readonly" onCreated={vi.fn()} />);
    expect((screen.getByRole("button", { name: "createActivity" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
