import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.masahiroiwamatsu.com',
  output: 'static',
  integrations: [sitemap()]
});
