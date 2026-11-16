import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';

// The deploy workflow sets SITE_URL and BASE_PATH from the GitHub Pages settings.
// Without them (local development) the defaults match this repository's Pages address.
// An empty BASE_PATH means "served from the root", as with a custom domain.
const site = process.env.SITE_URL || 'https://ltvms-hephaestus-dev.github.io';
const base = process.env.BASE_PATH === undefined ? '/Hephaestus-Bot' : process.env.BASE_PATH || '/';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [preact()],
});
