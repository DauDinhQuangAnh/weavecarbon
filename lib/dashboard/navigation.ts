// The nine descriptors below are the user's frozen navigation contract.
export const PROTECTED_MENU_ITEMS = [
  { icon: "BarChart3", labelKey: "overview", path: "/overview" },
  { icon: "Package", labelKey: "product", path: "/products" },
  { icon: "Truck", labelKey: "logistics", path: "/logistics" },
  { icon: "CalculatorIcon", labelKey: "calculator", path: "/carbon-calculator" },
  { icon: "FileText", labelKey: "evidence", path: "/evidence" },
  { icon: "FileCheck", labelKey: "export", path: "/export" },
  { icon: "TrendingUp", labelKey: "reports", path: "/reports" },
  { icon: "History", labelKey: "auditTrail", path: "/audit-trail" },
  { icon: "CreditCard", labelKey: "billing", path: "/billing" },
] as const;

export const SIDEBAR_GROUPS = [
  { id: "carbon", label: "Carbon", icon: "BarChart3", items: [
    { path: "/emissions", label: "Phát thải", icon: "BarChart3" },
    { path: "/processes", label: "Quy trình", icon: "Workflow" },
    { path: "/facilities", label: "Cơ sở sản xuất", icon: "Factory" },
    { path: "/carbon-operations", label: "Vận hành carbon", icon: "Factory" },
    { path: "/industry-packs", label: "Industry Packs", icon: "Layers3" },
  ] },
  { id: "data", label: "Dữ liệu", icon: "Layers3", items: [
    { path: "/activity-data", label: "Dữ liệu hoạt động", icon: "Activity" },
    { path: "/evidence-graph", label: "Đồ thị bằng chứng", icon: "GitBranch" },
    { path: "/data-quality", label: "Chất lượng dữ liệu", icon: "DatabaseZap" },
    { path: "/inbox", label: "Hộp thư công việc", icon: "Inbox" },
    { path: "/data-gap", label: "Kiểm tra dữ liệu", icon: "AlertCircle" },
  ] },
  { id: "supply-chain", label: "Chuỗi cung ứng", icon: "Truck", items: [
    { path: "/suppliers", label: "Nhà cung cấp", icon: "Users" },
  ] },
  { id: "intelligence", label: "Phân tích", icon: "Flame", items: [
    { path: "/hotspots", label: "Điểm nóng phát thải", icon: "Flame" },
    { path: "/climate-risk", label: "Rủi ro khí hậu", icon: "CloudSun" },
  ] },
  { id: "readiness", label: "Sẵn sàng", icon: "ClipboardCheck", items: [
    { path: "/vietnam-carbon", label: "Carbon Việt Nam", icon: "Factory" },
    { path: "/compliance", label: "Tuân thủ", icon: "ShieldCheck" },
    { path: "/verification", label: "Review & xác minh", icon: "ShieldCheck" },
    { path: "/mitigation-operations", label: "Giảm phát thải & hạn ngạch", icon: "Scale" },
  ] },
  { id: "connected-data", label: "Dữ liệu kết nối", icon: "RadioTower", items: [
    { path: "/connected-data", label: "WeaveNode", icon: "RadioTower" },
  ] },
] as const;

export function isNavigationActive(pathname: string, target: string) {
  return pathname === target || pathname.startsWith(`${target}/`);
}
export function canShowNavigation(path: string, access: { isDemo: boolean; isTrial: boolean; canAccessSettings: boolean }) {
  if (path === "/settings") return !access.isDemo && access.canAccessSettings;
  if (access.isTrial && (path === "/export" || path === "/reports")) return false;
  return true;
}
