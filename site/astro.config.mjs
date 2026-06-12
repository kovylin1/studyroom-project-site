import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  site: 'https://studyroom.kz',
  trailingSlash: 'never',
  i18n: {
    locales: ['ru', 'en', 'kk'],
    defaultLocale: 'ru',
    routing: { prefixDefaultLocale: false },
  },
  redirects: {
    '/v2': '/',
  },
  integrations: [
    sitemap({
      // Внутренние страницы не индексируем (см. также robots.txt).
      filter: (page) => !/\/(manager|admin)(\/|$)/.test(page),
    }),
  ],
  build: {
    format: 'directory',
  },
  vite: {
    resolve: {
      alias: {
        '~': srcDir,
      },
    },
  },
});
