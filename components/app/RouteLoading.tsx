// Màn chờ chung khi chuyển trang trong dashboard (tài khoản thật và demo dùng chung).
// Chỉ thay vùng nội dung — sidebar và tiêu đề giữ nguyên. Hiện dần sau ~180 ms nên các lần
// chuyển trang nhanh không bị nháy; lần chậm thì có phản hồi ngay vị trí nội dung.
export default function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Đang tải trang"
      className="space-y-4 md:space-y-6"
      style={{ animation: "fadeIn 220ms ease-out 180ms both" }}
    >
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-2xl border border-border bg-card" />
      <span className="sr-only">Đang tải trang…</span>
    </div>
  );
}
