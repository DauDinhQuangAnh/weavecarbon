// Điều hướng dashboard theo chuẩn bản Lovable:
// Tổng quan → 6 nhóm nghiệp vụ → Báo cáo / Gói dịch vụ / Cài đặt.
// Mỗi trang chỉ xuất hiện đúng một lần (không chồng tính năng giữa các mục).
export type NavigationEntry = { path: string; icon: string; labelKey?: string; label?: string };

export const ROOT_MENU_ITEMS: readonly NavigationEntry[] = [
  { icon: "BarChart3", labelKey: "overview", path: "/overview" },
];

export const SIDEBAR_GROUPS = [
  { id: "carbon", label: "Carbon", icon: "BarChart3", items: [
    { path: "/emissions", label: "Phát thải", icon: "BarChart3" },
    { path: "/products", labelKey: "product", icon: "Package" },
    { path: "/processes", label: "Quy trình", icon: "Workflow" },
    { path: "/facilities", label: "Cơ sở sản xuất", icon: "Factory" },
    { path: "/carbon-calculator", labelKey: "calculator", icon: "CalculatorIcon" },
    { path: "/carbon-operations", label: "Vận hành carbon", icon: "Activity" },
    { path: "/industry-packs", label: "Industry Packs", icon: "Layers3" },
  ] },
  { id: "data", label: "Dữ liệu", icon: "Layers3", items: [
    { path: "/activity-data", label: "Dữ liệu hoạt động", icon: "Activity" },
    { path: "/evidence", labelKey: "evidence", icon: "FileText" },
    { path: "/evidence-graph", label: "Đồ thị bằng chứng", icon: "GitBranch" },
    { path: "/data-quality", label: "Chất lượng dữ liệu", icon: "DatabaseZap" },
    { path: "/audit-trail", labelKey: "auditTrail", icon: "History" },
    { path: "/inbox", label: "Hộp thư công việc", icon: "Inbox" },
  ] },
  { id: "supply-chain", label: "Chuỗi cung ứng", icon: "Truck", items: [
    { path: "/suppliers", label: "Nhà cung ứng", icon: "Users" },
    { path: "/logistics", labelKey: "logistics", icon: "Truck" },
  ] },
  { id: "intelligence", label: "Phân tích", icon: "Flame", items: [
    { path: "/hotspots", label: "Điểm nóng phát thải", icon: "Flame" },
    { path: "/climate-risk", label: "Rủi ro khí hậu", icon: "CloudSun" },
  ] },
  { id: "readiness", label: "Sẵn sàng", icon: "ClipboardCheck", items: [
    { path: "/vietnam-carbon", label: "Carbon Việt Nam", icon: "Factory" },
    { path: "/compliance", label: "Tuân thủ", icon: "ShieldCheck" },
    { path: "/verification", label: "Xác minh", icon: "ShieldCheck" },
    { path: "/export", labelKey: "export", icon: "FileCheck" },
    { path: "/mitigation-operations", label: "Giảm phát thải & hạn ngạch", icon: "Scale" },
  ] },
  { id: "connected-data", label: "Dữ liệu kết nối", icon: "RadioTower", items: [
    { path: "/connected-data", label: "WeaveNode", icon: "RadioTower" },
  ] },
] as const;

export const TAIL_MENU_ITEMS: readonly NavigationEntry[] = [
  { icon: "TrendingUp", labelKey: "reports", path: "/reports" },
  { icon: "CreditCard", labelKey: "billing", path: "/billing" },
];

/** Tất cả đường dẫn xuất hiện trên menu (mỗi đường dẫn đúng một lần). */
export const ALL_MENU_PATHS: string[] = [
  ...ROOT_MENU_ITEMS.map((item) => item.path),
  ...SIDEBAR_GROUPS.flatMap((group) => group.items.map((item) => item.path as string)),
  ...TAIL_MENU_ITEMS.map((item) => item.path),
  "/settings",
];

export function isNavigationActive(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}
export function canShowNavigation(path: string, access: { isDemo: boolean; isTrial: boolean; canAccessSettings: boolean }) {
  if (path === "/settings") return !access.isDemo && access.canAccessSettings;
  if (access.isTrial && (path === "/export" || path === "/reports")) return false;
  return true;
}
