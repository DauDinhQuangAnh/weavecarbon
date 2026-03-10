"use client";

import { RotateCcw, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useDemo } from "@/components/demo/DemoProvider";

const DemoBanner = () => {
  const router = useRouter();
  const { resetDemo } = useDemo();
  const { exitDemoSession, hasRealSession } = useAuth();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
        onClick={() => {
          void resetDemo();
        }}
      >
        <RotateCcw className="h-4 w-4" />
        Reset demo
      </button>
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        onClick={async () => {
          await exitDemoSession();
          router.push(hasRealSession ? "/overview" : "/auth?type=b2b");
        }}
      >
        <LogOut className="h-4 w-4" />
        Thoát demo
      </button>
    </div>
  );
};

export default DemoBanner;
