"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { Loader2 } from "lucide-react";
import { createDemoApiRequestAdapter } from "@/lib/demo/apiAdapter";
import { ensureDemoDataset, resetDemoDataset } from "@/lib/demo/storage";
import { ensureDemoSession } from "@/lib/demo/session";
import { setApiRequestAdapter } from "@/lib/apiClient";
import { writeSubscriptionLockState } from "@/lib/subscriptionLockState";

interface DemoContextValue {
  ready: boolean;
  resetDemo: () => Promise<void>;
}

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

const setDemoSubscriptionState = () => {
  writeSubscriptionLockState({
    current_plan: "standard",
    trial_ends_at: null,
    trial_expired: false,
    features_locked: false,
  });
};

const DemoProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const adapter = useMemo(() => createDemoApiRequestAdapter(), []);

  useLayoutEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        setApiRequestAdapter(adapter);
        ensureDemoDataset();
        ensureDemoSession();
        setDemoSubscriptionState();
        if (active) {
          setReady(true);
          setError(null);
        }
      } catch (bootstrapError) {
        if (active) {
          setReady(false);
          setError(
            bootstrapError instanceof Error
              ? bootstrapError.message
              : "Failed to load demo data."
          );
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
      setApiRequestAdapter(null);
    };
  }, [adapter]);

  const resetDemo = useCallback(async () => {
    resetDemoDataset();
    ensureDemoSession();
    setDemoSubscriptionState();
    window.location.reload();
  }, []);

  const value = useMemo(
    () => ({
      ready,
      resetDemo,
    }),
    [ready, resetDemo]
  );

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Không thể tải dữ liệu demo</h2>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <button
            type="button"
            className="mt-4 inline-flex rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
            onClick={() => {
              void resetDemo();
            }}
          >
            Thử nạp lại dữ liệu mẫu
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Đang tải chế độ demo...</span>
        </div>
      </div>
    );
  }

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
};

export const useDemo = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used within DemoProvider.");
  }
  return context;
};

export default DemoProvider;
