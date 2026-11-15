"use client";

import Link from "next/link";
import { AlertTriangle, Database, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cảnh báo dữ liệu demo + lối tắt sang Phòng demo theo ngành / đăng ký / đăng nhập. */
export default function DemoDatasetBanner() {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm md:flex-row md:items-start md:justify-between">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="space-y-1">
          <p className="font-semibold uppercase tracking-wide text-foreground">
            Dữ liệu demo — không dùng để nộp buyer, auditor hoặc tạo báo cáo chính thức.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Demo Workspace kết hợp dữ liệu đầu vào công khai có nguồn với các phép tính demo của Weave được gắn nhãn rõ
            ràng. Giá trị từ nguồn công khai có thể kiểm tra trong Phòng demo theo ngành. Các phân bổ, kịch bản và bằng
            chứng mẫu không phải dữ liệu đủ điều kiện nộp chính thức nếu chưa được xác minh độc lập.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link href="/demo/demo-lab" prefetch={false}>
            <Database className="h-3.5 w-3.5" />
            Phòng demo theo ngành
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/auth?mode=signup" prefetch={false}>
            <UserPlus className="h-3.5 w-3.5" />
            Đăng ký doanh nghiệp
          </Link>
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href="/auth?forceLogin=1" prefetch={false}>
            <LogIn className="h-3.5 w-3.5" />
            Đăng nhập tài khoản thật
          </Link>
        </Button>
      </div>
    </div>
  );
}
