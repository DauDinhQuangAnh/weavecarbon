import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#eef6f0_0%,#f7f5ec_100%)] px-6 py-10 text-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[-4rem] h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-[-4rem] bottom-[-5rem] h-72 w-72 rounded-full bg-lime-200/30 blur-3xl" />
      </div>

      <section className="relative w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_28px_90px_rgba(32,72,48,0.12)] backdrop-blur sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_14px_30px_rgba(5,150,105,0.28)]">
          <Compass className="h-6 w-6" />
        </div>

        <p className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          404
        </p>

        <h1 className="mx-auto mt-6 max-w-[20ch] font-sans text-3xl font-bold leading-tight text-slate-950 sm:text-[2.5rem]">
          Không tìm thấy trang
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
          Trang bạn đang tìm không tồn tại hoặc đã được di chuyển.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <Button asChild className="gap-2">
            <Link href="/">Về trang chủ</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
