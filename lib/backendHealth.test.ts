import { describe, expect, it } from "vitest";
import { isBackendHealthyStatus } from "./backendHealth";

describe("backend health status contract", () => {
  it.each(["healthy", "ready", " HEALTHY ", "READY"])(
    "accepts %s as available",
    (status) => {
      expect(isBackendHealthyStatus(status)).toBe(true);
    }
  );

  it.each(["unhealthy", "not_ready", "starting", ""])(
    "rejects %s as unavailable",
    (status) => {
      expect(isBackendHealthyStatus(status)).toBe(false);
    }
  );
});
