import { slaplyConfig } from "../lib/slaply-config";

export default function sitemap() {
  const siteUrl = slaplyConfig.siteUrl.replace(/\/$/, "");
  const now = new Date();

  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1
    },
    {
      url: `${siteUrl}/scan`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8
    }
  ];
}
