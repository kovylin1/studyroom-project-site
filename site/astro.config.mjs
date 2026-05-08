import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  site: 'https://studyroom.kz',
  trailingSlash: 'never',
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
