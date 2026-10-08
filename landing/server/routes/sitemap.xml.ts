import { SCREENSHOTS } from '#shared/site';

/** The one page, with its screenshots for image search. */
export default defineEventHandler(event => {
  const siteUrl = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '');
  const images = SCREENSHOTS.map(
    shot => `    <image:image><image:loc>${siteUrl}/screenshots/${shot.id}.png</image:loc></image:image>`,
  );
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    '  <url>',
    `    <loc>${siteUrl}/</loc>`,
    ...images,
    '  </url>',
    '</urlset>',
    '',
  ].join('\n');
});
