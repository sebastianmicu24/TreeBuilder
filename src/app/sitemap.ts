import type { MetadataRoute } from "next";

const BASE = "https://www.sebastianmicu.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/medico", "/paziente", "/simboli", "/privacy"].map((path) => ({ url: `${BASE}${path}` }));
}
