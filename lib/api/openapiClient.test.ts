import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn()
}));

vi.mock("@/lib/apiClient", () => ({
  apiRequest: apiRequestMock
}));

import { openApiClient } from "./openapiClient";

describe("openApiClient", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("uses generated query types and preserves the existing request transport", async () => {
    apiRequestMock.mockResolvedValueOnce([]);

    await openApiClient.get("/company/members", {
      query: { role: "member", status: "active" },
      disableResponseCache: true
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/company/members?role=member&status=active",
      expect.objectContaining({ method: "GET", disableResponseCache: true })
    );
  });

  it("encodes generated path parameters", async () => {
    apiRequestMock.mockResolvedValueOnce(undefined);

    await openApiClient.delete("/company/members/{id}", {
      path: { id: "member/with slash" }
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/company/members/member%2Fwith%20slash",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
