import { Leaf, RefreshCcw, Wrench } from "lucide-react";

interface MaintenanceScreenProps {
  healthUrl: string;
}

export default function MaintenanceScreen({ healthUrl }: MaintenanceScreenProps) {
  void healthUrl;

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#eef6f0_0%,#f7f5ec_100%)] px-6 py-10 text-slate-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-6rem] top-[-4rem] h-64 w-64 rounded-full bg-emerald-300/20 blur-3xl" />
        <div className="absolute right-[-4rem] bottom-[-5rem] h-72 w-72 rounded-full bg-lime-200/30 blur-3xl" />
      </div>

      <section className="relative w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-[0_28px_90px_rgba(32,72,48,0.12)] backdrop-blur sm:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-[0_14px_30px_rgba(5,150,105,0.28)]">
          <Leaf className="h-6 w-6" />
        </div>

        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
          <Wrench className="h-4 w-4" />
          Web đang bảo trì
        </div>

        <h1 className="mx-auto mt-6 max-w-[16ch] font-sans text-3xl font-bold leading-tight text-slate-950 sm:text-[3rem]">
          WeaveCarbon đang bảo trì
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
          Hệ thống đang được bảo trì để ổn định dịch vụ. Vui lòng quay lại sau ít phút.
        </p>

        <form action="" method="get" className="mt-8">
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(5,150,105,0.22)] transition hover:bg-emerald-700"
          >
            <RefreshCcw className="h-4 w-4" />
            Tải lại trang
          </button>
        </form>
      </section>
    </main>
  );
}
