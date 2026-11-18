import Link from "next/link";
import type { ReactNode } from "react";

export const LEGAL_DRAFT_VERSION = "Bản nháp 0.1 · 18/11/2026";

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Về trang chủ
        </Link>
        <h1 className="mt-4 text-3xl font-display font-bold">{title}</h1>
        <div
          role="note"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <strong>Bản nháp, chờ duyệt pháp lý.</strong> Văn bản này do nhóm sản phẩm soạn để
          minh bạch cách WeaveCarbon vận hành và xử lý dữ liệu. Nội dung chưa được luật sư rà soát
          và có thể thay đổi trước khi có hiệu lực chính thức. ({LEGAL_DRAFT_VERSION})
        </div>
        <div className="prose prose-slate mt-8 max-w-none space-y-6 text-[15px] leading-7 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
          {children}
        </div>
      </div>
    </main>
  );
}
