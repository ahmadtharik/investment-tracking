/** The public address of the site: Vercel's production domain when deployed, otherwise local. */
export function siteUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? `https://${host}` : 'http://localhost:3000';
}
