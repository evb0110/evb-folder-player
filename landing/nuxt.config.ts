const siteUrl = process.env.NUXT_PUBLIC_SITE_URL || 'https://evb-folder-player.vercel.app';

export default defineNuxtConfig({
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  compatibilityDate: '2026-09-22',
  ui: { fonts: false },
  colorMode: { preference: 'light', fallback: 'light' },
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
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
      meta: [{ name: 'theme-color', content: '#F1F6ED' }],
    },
  },
  // The page embeds the latest release; Vercel regenerates it at most every ten minutes.
  routeRules: {
    '/': { isr: 600 },
  },
  typescript: { strict: true },
});
