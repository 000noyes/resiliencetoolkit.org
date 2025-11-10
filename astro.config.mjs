import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // Production site URL - Update this with your actual domain after deployment
  site: 'https://resiliencetoolkit-org.onrender.com',

  // Server-side rendering for auth-protected pages
  // Mark static pages with prerender: true if needed
  output: 'server',

  // Node.js adapter for server-side rendering (required for SSR pages)
  adapter: node({
    mode: 'standalone',
  }),

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