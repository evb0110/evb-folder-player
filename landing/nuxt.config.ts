const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://evb-folder-player.vercel.app';
// Images and films keep their names when they are replaced, so browsers keep them for a day only.
const cachedForADay = { headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } };

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  compatibilityDate: '2026-09-22',
  ui: { fonts: false },
  // Light or dark, as the visitor's system prefers.
  colorMode: { preference: 'system', fallback: 'light' },
  // Icons ship with the page instead of loading from the Iconify API.
  icon: {
    provider: 'none',
    clientBundle: { scan: { globInclude: ['app/**/*.{vue,ts}'] } },
    serverBundle: 'local',
  },
  runtimeConfig: {
    public: { siteUrl },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/icon.png' },
      ],
      meta: [
        { name: 'theme-color', content: '#F1F6ED', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#0E1513', media: '(prefers-color-scheme: dark)' },
      ],
    },
  },
  // The page embeds the latest release; Vercel regenerates it at most every ten minutes. Robots and
  // the sitemap depend only on the site URL, so they are built once.
  routeRules: {
    '/': { isr: 600 },
    '/robots.txt': { prerender: true },
    '/sitemap.xml': { prerender: true },
    '/screenshots/**': cachedForADay,
    '/films/**': cachedForADay,
    '/icon.png': cachedForADay,
  },
  typescript: { strict: true },
});
