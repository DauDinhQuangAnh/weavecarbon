import type { MetadataRoute } from "next";

const SITE_URL = "https://weavecarbon.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-11-18");
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/calculator`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.2 }
  ];
}
