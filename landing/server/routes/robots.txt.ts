/** Every crawler may index the page; the release API is not content. */
export default defineEventHandler(event => {
  const siteUrl = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '');
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  return `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
});
