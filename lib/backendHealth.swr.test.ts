import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithPolicy = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/http/requestPolicy", () => ({ fetchWithPolicy: (...args: unknown[]) => fetchWithPolicy(...args) }));

const healthy = () => new Response(JSON.stringify({ status: "healthy" }), { status: 200 });

describe("getBackendHealth stale-while-revalidate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T00:00:00Z"));
    process.env.BACKEND_HEALTH_URL = "http://be.internal/health";
    fetchWithPolicy.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.BACKEND_HEALTH_URL;
  });

  it("trả ngay kết quả khỏe cũ khi hết hạn và chỉ kiểm tra lại ở nền", async () => {
    const { getBackendHealth, clearBackendHealthCache } = await import("./backendHealth");
    clearBackendHealthCache();
    fetchWithPolicy.mockResolvedValueOnce(healthy());
    expect((await getBackendHealth()).healthy).toBe(true);

    vi.setSystemTime(new Date("2026-11-19T00:01:00Z"));
    fetchWithPolicy.mockReturnValueOnce(new Promise(() => {})); // lần kiểm tra lại chưa xong
    const result = await getBackendHealth();
    expect(result.healthy).toBe(true);
    expect(fetchWithPolicy).toHaveBeenCalledTimes(2);

    await getBackendHealth(); // đang kiểm tra lại: không gửi thêm request
    expect(fetchWithPolicy).toHaveBeenCalledTimes(2);
  });

  it("chờ kết quả mới khi lần trước không khỏe", async () => {
    const { getBackendHealth, clearBackendHealthCache } = await import("./backendHealth");
    clearBackendHealthCache();
    fetchWithPolicy.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    expect((await getBackendHealth()).healthy).toBe(false);

    vi.setSystemTime(new Date("2026-11-19T00:00:10Z"));
    fetchWithPolicy.mockResolvedValueOnce(healthy());
    expect((await getBackendHealth()).healthy).toBe(true);
  });
});
