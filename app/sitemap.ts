import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL } from "@/lib/site-metadata";
import { publishedSeries, seriesPathKey } from "@/lib/public-series";
export const revalidate = 3600;
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const series = await publishedSeries();
  const paths = [
    ...PUBLIC_ROUTES,
    ...series.map((s) => `/series/${seriesPathKey(s.title)}`),
  ];
  // No invented last-modified dates; account/editor/admin routes stay out.
  return [...new Set(paths)].map((path) => ({ url: `${SITE_URL}${path}` }));
}
