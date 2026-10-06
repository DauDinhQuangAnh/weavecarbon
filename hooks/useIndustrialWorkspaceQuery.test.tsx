// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "user-a", company_id: "company-a" } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth }));
import { useIndustrialWorkspaceQuery } from "./useIndustrialWorkspaceQuery";
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
afterEach(() => { cleanup(); auth.user = { id: "user-a", company_id: "company-a" }; });
describe("tenant-scoped workspace requests", () => {
  it("ignores late responses from earlier reloads", async () => {
    const old = deferred<string>(), fresh = deferred<string>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
    const { result } = renderHook(() => useIndustrialWorkspaceQuery(load, false));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    act(() => { void result.current.reload(); });
    await act(async () => { fresh.resolve("fresh"); });
    expect(result.current.data).toBe("fresh");
    await act(async () => { old.resolve("old"); });
    expect(result.current.data).toBe("fresh");
  });
  it("hides old tenant data immediately and ignores retained mutation callbacks", async () => {
    const next = deferred<string>();
    const load = vi.fn().mockResolvedValueOnce("tenant-a").mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(() => useIndustrialWorkspaceQuery(load, false));
    await waitFor(() => expect(result.current.data).toBe("tenant-a"));
    const retainedReload = result.current.reload;
    auth.user = { id: "user-b", company_id: "company-b" };
    rerender();
    expect(result.current.data).toBeNull();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    await act(async () => { await retainedReload(); next.resolve("tenant-b"); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe("tenant-b");
  });
  it("hides previous selection when its loader changes", async () => {
    const next = deferred<string>();
    const initial = () => Promise.resolve("first");
    const other = () => next.promise;
    const { result, rerender } = renderHook(({ load }) => useIndustrialWorkspaceQuery(load, false), { initialProps: { load: initial } });
    await waitFor(() => expect(result.current.data).toBe("first"));
    rerender({ load: other });
    expect(result.current.data).toBeNull();
    await act(async () => { next.resolve("second"); });
    expect(result.current.data).toBe("second");
  });
  it("surfaces denied requests, allowing explicit retry without a fake demo fallback", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("403 access denied")).mockResolvedValueOnce([]);
    const { result } = renderHook(() => useIndustrialWorkspaceQuery(load, false));
    await waitFor(() => expect(result.current.error).toBe("403 access denied"));
    expect(result.current.data).toBeNull();
    await act(async () => { await result.current.reload(); });
    expect(result.current.error).toBeNull();
    expect(result.current.data).toEqual([]);
  });
});
