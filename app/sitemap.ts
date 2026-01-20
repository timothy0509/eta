import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://eta.hkjc.uk",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
