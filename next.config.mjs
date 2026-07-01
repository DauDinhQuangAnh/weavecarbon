import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig = {
  output: "standalone",
  reactStrictMode: false,
  transpilePackages: ["mapbox-gl"],
};

export default withNextIntl(nextConfig);
