"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useIndustrialWorkspaceQuery<T>(load: () => Promise<T>, demo: boolean) {
  const { user } = useAuth();
  const owner = `${demo ? "demo" : "real"}:${user?.id || ""}:${user?.company_id || ""}`;
  const [state, setState] = useState<{ owner: string; load: () => Promise<T>; data: T | null; loading: boolean; error: string | null }>({ owner, load, data: null, loading: true, error: null });
  const sequence = useRef(0);
  const active = useRef<{ owner: string; load: () => Promise<T> } | null>(null);
  const reload = useCallback(async () => {
    // Ignore callbacks retained by a mutation after tenant, selection or page changed.
    if (active.current?.owner !== owner || active.current?.load !== load) return;
    const request = ++sequence.current;
    setState({ owner, load, data: null, loading: true, error: null });
    try {
      const data = await load();
      if (request === sequence.current) setState({ owner, load, data, loading: false, error: null });
    } catch (error) {
      if (request === sequence.current) setState({ owner, load, data: null, loading: false, error: error instanceof Error ? error.message : "Không tải được dữ liệu. Vui lòng thử lại." });
    }
  }, [load, owner]);
  useEffect(() => {
    const counter = sequence;
    const current = active;
    current.current = { owner, load };
    void Promise.resolve().then(reload);
    return () => { counter.current++; current.current = null; };
  }, [load, owner, reload]);
  return { ...(state.owner === owner && state.load === load ? state : { data: null, loading: true, error: null }), reload };
}
