import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/calculator", "/terms", "/privacy"],
        // Workspaces, demo, auth flows and APIs are not useful search results.
        disallow: ["/api/", "/demo/", "/auth", "/onboarding", "/b2c", "/audit", "/passport"]
      }
    ],
    sitemap: "https://weavecarbon.com/sitemap.xml"
  };
}
