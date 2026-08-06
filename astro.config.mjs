import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://resiliencetoolkit.org',

  output: 'static',

  // The floating dev toolbar sits exactly where phone-viewport tests tap;
  // test dev servers (playwright.workshop.config.ts) disable it via env.
  devToolbar: {
    enabled: !process.env.PLAYWRIGHT_TEST,
  },

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp'
    }
  },

  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],

  server: {
    host: '0.0.0.0',
  },

  vite: {
    resolve: {
      alias: {
        '@': '/src',
        '@/components': '/src/components',
        '@/design-system': '/src/design-system',
        '@/layouts': '/src/layouts',
        '@/lib': '/src/lib',
      },
    },
  },
});