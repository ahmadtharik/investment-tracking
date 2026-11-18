import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site';

/** Only the public pages are worth indexing; everything else needs a sign-in. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/login'], disallow: ['/api/', '/dashboard', '/plan', '/portfolio', '/accounts', '/projections', '/settings', '/fx', '/rules', '/update-password', '/forgot-password'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
