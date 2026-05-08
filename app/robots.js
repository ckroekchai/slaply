import { slaplyConfig } from "../lib/slaply-config";

export default function robots() {
  const siteUrl = slaplyConfig.siteUrl.replace(/\/$/, "");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"]
    },
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
