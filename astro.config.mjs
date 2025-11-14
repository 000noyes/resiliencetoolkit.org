import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  // Production site URL - Update this with your actual domain after deployment
  site: 'https://resiliencetoolkit-org.onrender.com',

  // Static site generation for fully local app
  output: 'static',

  integrations: [
    react(),
    mdx(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],

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