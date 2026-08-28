import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMock } = vi.hoisted(() => ({
  getMock: vi.fn()
}));

vi.mock("./openapiClient", () => ({
  openApiClient: { get: getMock }
}));

import { listCompanyMembers } from "./companyMembers";

describe("companyMembers adapter", () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it("maps the generated snake_case transport into the UI domain model", async () => {
    getMock.mockResolvedValueOnce([
      {
        id: "membership-1",
        user_id: "user-1",
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        role: "member",
        status: "active",
        last_login: null,
        created_at: "2026-08-28T00:00:00.000Z"
      }
    ]);

    await expect(listCompanyMembers({ role: "member" })).resolves.toEqual([
      {
        id: "membership-1",
        userId: "user-1",
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        role: "member",
        status: "active",
        lastLogin: null,
        createdAt: "2026-08-28T00:00:00.000Z"
      }
    ]);
    expect(getMock).toHaveBeenCalledWith("/company/members", {
      query: { role: "member" }
    });
  });
});
