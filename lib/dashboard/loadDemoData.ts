// Tải dữ liệu demo theo nhu cầu: chỉ khi đang ở /demo mới tải bộ cache phiên demo + dữ liệu mẫu,
// để bundle của tài khoản thật không phải mang theo dữ liệu demo.
//
// Cách dùng trong component: hàm tải dữ liệu (load) của nhánh demo gọi `await loadDemoData()` trước;
// sau đó các handler đồng bộ dùng `demoCache()` / `demoData()` (module đã nằm sẵn trong bộ nhớ).
const importDemoData = async () => {
  const [cache, data] = await Promise.all([import("./demoSessionCache"), import("./industrialDemoData")]);
  return { demoSessionCache: cache.demoSessionCache, ...data };
};

export type DemoData = Awaited<ReturnType<typeof importDemoData>>;

let loaded: DemoData | null = null;
let pending: Promise<DemoData> | null = null;

export function loadDemoData(): Promise<DemoData> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= importDemoData().then((data) => {
    loaded = data;
    return data;
  });
  return pending;
}

/** Dữ liệu demo đã tải; ném lỗi nếu gọi trước khi `loadDemoData()` hoàn tất. */
export function demoData(): DemoData {
  if (!loaded) throw new Error("Dữ liệu demo chưa tải xong, vui lòng thử lại.");
  return loaded;
}

/** Cache phiên demo (sessionStorage) — xem `demoData()`. */
export const demoCache = () => demoData().demoSessionCache;
