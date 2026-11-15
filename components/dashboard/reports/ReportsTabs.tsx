"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Scale, Sparkles } from "lucide-react";
import { isDemoPath } from "@/lib/demo/routes";
import { cn } from "@/lib/utils";

/**
 * Một mục "Báo cáo" duy nhất trên menu (chuẩn Lovable):
 * AI Report Builder và các báo cáo đã lưu là hai tab của cùng một khu vực.
 */
export default function ReportsTabs() {
  const pathname = usePathname() ?? "";
  const base = isDemoPath(pathname) ? "/demo" : "";
  const tabs = [
    { href: `${base}/report-builder`, label: "AI Report Builder", icon: Sparkles },
    { href: `${base}/reports/registry`, label: "Pháp lý & thị trường", icon: Scale },
    { href: `${base}/reports`, label: "Xuất dữ liệu & báo cáo đã lưu", icon: FileText },
  ];
  return (
    <nav aria-label="Khu vực báo cáo" className="mb-5 inline-flex flex-wrap gap-1 rounded-xl border border-white/70 bg-background/60 p-1 shadow-sm backdrop-blur-md">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-white/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
