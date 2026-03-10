export default function DemoLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
        <span>Dang mo trang demo...</span>
      </div>
    </div>
  );
}
