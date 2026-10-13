// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://ai-scout-tello.vercel.app',
  output: 'server',
  devToolbar: { enabled: false },
  integrations: [react()],
  adapter: vercel({
    // League warm-up spaces API calls to respect 10 req/min, so it needs a long budget.
    maxDuration: 300,
    webAnalytics: { enabled: true },
  }),
  vite: {
    plugins: [tailwindcss()],
    // Native binary used for OG images; keep it out of the bundle.
    ssr: { external: ['@resvg/resvg-js'] },
  },
});
