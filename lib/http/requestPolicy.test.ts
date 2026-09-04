import { afterEach, describe, expect, it, vi } from "vitest";
import {
  HttpTimeoutError,
  createCorrelationId,
  fetchWithPolicy
} from "./requestPolicy";

describe("fetchWithPolicy", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("retries a transient GET response and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithPolicy(
      "https://example.test/data",
      { method: "GET" },
      { retries: 1, retryDelayMs: 0, timeoutMs: 1000 }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a mutation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("busy", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithPolicy(
      "https://example.test/data",
      { method: "POST" },
      { retries: 3, retryDelayMs: 0, timeoutMs: 1000 }
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("honors caller cancellation", async () => {
    const caller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("cancelled")));
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const request = fetchWithPolicy(
      "https://example.test/data",
      { signal: caller.signal },
      { retries: 0, timeoutMs: 1000 }
    );
    caller.abort(new Error("caller cancelled"));

    await expect(request).rejects.toThrow("caller cancelled");
  });

  it("converts the operation deadline into a typed timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
      )
    );

    const request = fetchWithPolicy(
      "https://example.test/data",
      {},
      { retries: 0, timeoutMs: 50 }
    );
    const assertion = expect(request).rejects.toBeInstanceOf(HttpTimeoutError);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});

describe("createCorrelationId", () => {
  it("returns a non-empty request identifier", () => {
    expect(createCorrelationId()).toMatch(/\S+/);
  });
});
