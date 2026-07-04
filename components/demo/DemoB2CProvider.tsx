"use client";

import React, {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { createDemoB2CApiRequestAdapter } from "@/lib/demo/apiAdapter";
import { setApiRequestAdapter } from "@/lib/apiClient";

interface DemoB2CContextValue {
  ready: boolean;
}

const DemoB2CContext = createContext<DemoB2CContextValue | undefined>(undefined);

const DemoB2CProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adapter = useMemo(() => createDemoB2CApiRequestAdapter(), []);

  useLayoutEffect(() => {
    let active = true;
    try {
      setApiRequestAdapter(adapter);
      if (active) {
        setReady(true);
        setError(null);
      }
    } catch (err) {
      if (active) {
        setReady(false);
        setError(err instanceof Error ? err.message : "Không thể tải chế độ demo B2C.");
      }
    }
    return () => {
      active = false;
      setApiRequestAdapter(null);
    };
  }, [adapter]);

  const value = useMemo(() => ({ ready }), [ready]);

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Không thể tải dữ liệu demo B2C
          </h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Đang tải chế độ demo B2C...</span>
        </div>
      </div>
    );
  }

  return (
    <DemoB2CContext.Provider value={value}>{children}</DemoB2CContext.Provider>
  );
};

export const useDemoB2C = () => {
  const context = useContext(DemoB2CContext);
  if (!context) {
    throw new Error("useDemoB2C must be used within DemoB2CProvider.");
  }
  return context;
};

export default DemoB2CProvider;
