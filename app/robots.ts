import type {MetadataRoute} from 'next';
import {privatePaths, siteUrl} from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {userAgent: '*', allow: '/', disallow: privatePaths},
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
