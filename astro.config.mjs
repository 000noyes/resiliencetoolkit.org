import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

// https://astro.build/config
export default defineConfig({
  site: 'https://resiliencetoolkit.org',

  output: 'static',

  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp'
    }
  },

  integrations: [
    mdx(),
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