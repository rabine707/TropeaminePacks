import type {MetadataRoute} from 'next';
import {publicPaths, siteUrl} from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  // Series details are client-resolved, so list only the verified landing page.
  // Do not invent lastModified dates or enumerate arbitrary catch-all URLs.
  return publicPaths.map(path => ({url: new URL(path, siteUrl).href}));
}
