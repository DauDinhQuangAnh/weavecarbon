"use client";
import { useEffect, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useDashboardTitle } from "@/contexts/DashboardContext";
import { Button } from "@/components/ui/button";
export default function WorkspaceFrame({ title, description, demo, loading, error, reload, children }: {
  title: string; description: string; demo: boolean; loading: boolean; error: string | null; reload: () => void; children: ReactNode;
}) {
  const { setPageTitle } = useDashboardTitle();
  useEffect(() => { setPageTitle(title, description); }, [setPageTitle, title, description]);
  return <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">Dữ liệu carbon công nghiệp</p><h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p></div>
      <Button variant="outline" disabled={loading} onClick={reload}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Tải lại</Button>
    </header>
    {demo && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Demo chỉ đọc · dữ liệu tổng hợp để minh họa, không phải số đo hoặc kết quả xác minh của doanh nghiệp.</p>}
    {loading ? <p role="status" className="py-12 text-center text-muted-foreground">Đang tải dữ liệu…</p> : error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800"><p>{error}</p><Button className="mt-3" variant="outline" onClick={reload}>Thử lại</Button></div> : children}
  </div>;
}
export function EmptyWorkspace({ children }: { children: ReactNode }) { return <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center text-sm leading-6 text-muted-foreground">{children}</div>; }
