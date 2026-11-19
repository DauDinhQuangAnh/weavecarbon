import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

// Ảnh chuỗi intro + model lá ở hero landing: ~200 file tĩnh. Mặc định Next trả
// `max-age=0` nên mỗi lần vào trang trình duyệt phải hỏi lại server từng file,
// làm intro dừng chờ. Cho dùng cache ngay (stale-while-revalidate cập nhật nền).
const HERO_ASSET_CACHE = "public, max-age=86400, stale-while-revalidate=2592000";

const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  async headers() {
    return [
      { source: "/textures/:path*", headers: [{ key: "Cache-Control", value: HERO_ASSET_CACHE }] },
      { source: "/models/:path*", headers: [{ key: "Cache-Control", value: HERO_ASSET_CACHE }] },
    ];
  },
};

export default withNextIntl(nextConfig);
