// Pure logic + step catalogue for the demo "auto tour" (attract-loop / kiosk mode).
//
// The tour walks through the big B2B dashboard pages first, then the B2C
// section together with its sub-pages ("small pages within a large page").
// Only the index math and step lookup live here so they can be unit-tested
// without a DOM; all timers and DOM event wiring live in DemoAutoTour.tsx.

export type DemoTourGroup = "b2b" | "b2c";

export interface DemoTourStep {
  /** Absolute demo route (already carries the /demo prefix). */
  readonly route: string;
  /** Short human label shown in the floating control. */
  readonly label: string;
  /** Which section this step belongs to — big page vs. sub-page grouping. */
  readonly group: DemoTourGroup;
}

// Order mirrors the dashboard sidebar for the big B2B pages, then groups the
// B2C section (its landing page = the "large page", the rest = "small pages").
export const DEMO_TOUR_STEPS: readonly DemoTourStep[] = [
  { route: "/demo/overview", label: "Tổng quan", group: "b2b" },
  { route: "/demo/products", label: "Sản phẩm", group: "b2b" },
  { route: "/demo/logistics", label: "Logistics", group: "b2b" },
  { route: "/demo/carbon-calculator", label: "Máy tính carbon", group: "b2b" },
  { route: "/demo/evidence", label: "Chứng từ", group: "b2b" },
  { route: "/demo/data-gap", label: "Thiếu dữ liệu", group: "b2b" },
  { route: "/demo/export", label: "Xuất khẩu", group: "b2b" },
  { route: "/demo/reports", label: "Báo cáo", group: "b2b" },
  { route: "/demo/audit-trail", label: "Nhật ký kiểm toán", group: "b2b" },
  { route: "/demo/suppliers", label: "Nhà cung cấp", group: "b2b" },
  { route: "/demo/billing", label: "Thanh toán", group: "b2b" },
  { route: "/demo/b2c", label: "B2C · Trang chủ", group: "b2c" },
  { route: "/demo/b2c/collection-points", label: "B2C · Điểm thu gom", group: "b2c" },
  { route: "/demo/b2c/coupons", label: "B2C · Ưu đãi", group: "b2c" },
  { route: "/demo/b2c/donate", label: "B2C · Quyên góp", group: "b2c" },
  { route: "/demo/b2c/history", label: "B2C · Lịch sử", group: "b2c" },
] as const;

const stripTrailingSlash = (value: string) =>
  value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;

/** Next index in the loop; wraps back to the start after the final step. */
export const getNextTourIndex = (currentIndex: number, length: number): number => {
  if (length <= 0) return 0;
  const safeIndex = Number.isInteger(currentIndex) ? currentIndex : -1;
  return ((safeIndex % length) + length + 1) % length;
};

/** Previous index in the loop; wraps around to the final step. */
export const getPrevTourIndex = (currentIndex: number, length: number): number => {
  if (length <= 0) return 0;
  const safeIndex = Number.isInteger(currentIndex) ? currentIndex : 0;
  return ((safeIndex % length) + length - 1) % length;
};

/**
 * Index of the tour step matching a pathname, or -1 if the current page is
 * not part of the tour. Matches the exact route or a nested sub-path of it,
 * preferring the longest (most specific) match so /demo/b2c/history does not
 * get swallowed by /demo/b2c.
 */
export const findTourStepIndex = (
  pathname: string | null | undefined,
  steps: readonly DemoTourStep[] = DEMO_TOUR_STEPS
): number => {
  if (!pathname) return -1;
  const target = stripTrailingSlash(pathname.trim().toLowerCase());
  if (!target) return -1;

  let bestIndex = -1;
  let bestLength = -1;
  steps.forEach((step, index) => {
    const route = stripTrailingSlash(step.route.toLowerCase());
    const matches = target === route || target.startsWith(`${route}/`);
    if (matches && route.length > bestLength) {
      bestIndex = index;
      bestLength = route.length;
    }
  });
  return bestIndex;
};

/** Clamp an arbitrary index into a valid step position (0 when empty). */
export const clampTourIndex = (index: number, length: number): number => {
  if (length <= 0) return 0;
  if (!Number.isInteger(index) || index < 0) return 0;
  return Math.min(index, length - 1);
};
