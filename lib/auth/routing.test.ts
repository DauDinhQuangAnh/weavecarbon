import { describe, expect, it, vi } from "vitest";
import {
  buildAuthErrorUrl,
  buildCheckEmailUrl,
  normalizeCompanyCheck,
  resolveAuthenticatedUserType,
  resolvePostLoginPath
} from "@/lib/auth/routing";

describe("auth routing helpers", () => {
  it("normalizes nested company check payloads", () => {
    expect(
      normalizeCompanyCheck({
        data: {
          has_company: false,
          is_b2b: true,
          user_type: "b2b"
        }
      })
    ).toEqual({
      hasCompany: false,
      isB2b: true,
      userType: "b2b"
    });
  });

  it("builds the check-email url consistently", () => {
    expect(
      buildCheckEmailUrl({
        email: "hello@example.com",
        intent: "signin",
        source: "google",
        type: "b2b"
      })
    ).toBe("/auth/check-email?type=b2b&email=hello%40example.com&source=google&intent=signin");
  });

  it("builds auth error urls with optional descriptions", () => {
    expect(
      buildAuthErrorUrl({
        error: "ACCOUNT_TYPE_MISMATCH",
        errorDescription: "b2c",
        type: "b2b"
      })
    ).toBe("/auth?type=b2b&error=ACCOUNT_TYPE_MISMATCH&error_description=b2c");
  });

  it("prefers the account role when resolving the authenticated user type", async () => {
    const getCompanyCheckPayload = vi.fn();

    await expect(
      resolveAuthenticatedUserType({
        accountPayload: {
          roles: ["admin"]
        },
        getCompanyCheckPayload
      })
    ).resolves.toBe("admin");

    expect(getCompanyCheckPayload).not.toHaveBeenCalled();
  });

  it("falls back to company-check when account lookup errors are ignorable", async () => {
    await expect(
      resolveAuthenticatedUserType({
        getAccountPayload: async () => {
          throw new Error("temporary account lookup failure");
        },
        getCompanyCheckPayload: async () => ({
          has_company: false,
          is_b2b: true
        }),
        shouldIgnoreAccountError: () => true
      })
    ).resolves.toBe("b2b");
  });

  it("resolves onboarding for b2b users without a company", async () => {
    await expect(
      resolvePostLoginPath({
        accountType: "b2b",
        companyCheckPayload: {
          has_company: false,
          is_b2b: true
        }
      })
    ).resolves.toBe("/onboarding");
  });

  it("allows flow-specific error overrides when company-check fails", async () => {
    await expect(
      resolvePostLoginPath({
        getCompanyCheckPayload: async () => {
          throw new Error("unauthorized");
        },
        onCompanyCheckError: () => "/auth?error=UNAUTHORIZED",
        requestedType: "b2b"
      })
    ).resolves.toBe("/auth?error=UNAUTHORIZED");
  });
});
