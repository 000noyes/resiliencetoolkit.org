/**
 * Tailwind CSS Configuration - Design System Tokens
 *
 * This configuration extends Tailwind with custom design tokens using CSS variables.
 * CSS variables allow runtime theme switching (light/dark mode) without rebuilding.
 *
 * ## Why CSS Variables Instead of Static Colors?
 * - Runtime theme switching without JavaScript (via CSS class on <html>)
 * - Single source of truth (defined in src/styles/base.css)
 * - Easy to customize per-deployment via CSS
 * - Supports system preference detection
 *
 * ## Token Structure:
 * - Semantic naming (background, foreground, surface) not color names (blue, green)
 * - Hierarchical system (text.primary, text.secondary, text.muted)
 * - Component-specific tokens (table.*, editor.*, etc.)
 *
 * ## Dark Mode:
 * - Uses 'class' strategy (toggle via .dark class on <html>)
 * - CSS variables swap values in src/styles/base.css
 * - JavaScript in BaseLayout.astro prevents flash of unstyled content
 *
 * @see src/styles/base.css for CSS variable definitions
 * @see src/layouts/BaseLayout.astro for dark mode initialization
 */
import { breakpoints } from './src/lib/breakpoints.mjs';

/** One type-scale step: size and line height from base.css, plus its weight and tracking */
function step(name, extra) {
  return { [name]: [`var(--text-${name})`, { lineHeight: `var(--leading-${name})`, ...extra }] };
}

/** A Tailwind default name mapped to a step's size and line height only */
function alias(name, stepName) {
  return { [name]: [`var(--text-${stepName})`, { lineHeight: `var(--leading-${stepName})` }] };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class', // Toggle via .dark class (controlled by BaseLayout.astro)
  theme: {
    // The five breakpoints, from the one source (src/lib/breakpoints.mjs);
    // asserted equal by tests/build/breakpoints.test.ts
    screens: Object.fromEntries(
      Object.entries(breakpoints).map(([name, px]) => [name, `${px}px`])
    ),
    extend: {
      // Color tokens: All use CSS variables for theme switching
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          muted: 'var(--color-surface-muted)',
          elevated: 'var(--color-surface-elevated)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        table: {
          accent: 'var(--table-accent)',
          'accent-subtle': 'var(--table-accent-subtle)',
          'accent-hover': 'var(--table-accent-hover)',
          divider: 'var(--table-divider)',
          grid: 'var(--table-grid)',
          surface: 'var(--table-surface)',
          'surface-subtle': 'var(--table-surface-subtle)',
          heading: 'var(--table-heading)',
          body: 'var(--table-body)',
          'text-muted': 'var(--table-text-muted)',
          link: 'var(--table-link)',
          'link-hover': 'var(--table-link-hover)',
          'checkbox-border': 'var(--table-checkbox-border)',
          'checkbox-fill': 'var(--table-checkbox-fill)',
          'focus-ring': 'var(--table-focus-ring)',
        },
        card: {
          DEFAULT: 'var(--color-card)',
          foreground: 'var(--color-card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--color-popover)',
          foreground: 'var(--color-popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          foreground: 'var(--color-primary-foreground)',
          hover: 'var(--color-primary-hover)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          foreground: 'var(--color-secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--color-muted)',
          foreground: 'var(--color-muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--color-destructive)',
          foreground: 'var(--color-destructive-foreground)',
        },
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        chart: {
          1: 'var(--color-chart-1)',
          2: 'var(--color-chart-2)',
          3: 'var(--color-chart-3)',
          4: 'var(--color-chart-4)',
          5: 'var(--color-chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          foreground: 'var(--color-sidebar-foreground)',
          primary: 'var(--color-sidebar-primary)',
          'primary-foreground': 'var(--color-sidebar-primary-foreground)',
          accent: 'var(--color-sidebar-accent)',
          'accent-foreground': 'var(--color-sidebar-accent-foreground)',
          border: 'var(--color-sidebar-border)',
          ring: 'var(--color-sidebar-ring)',
        },
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        serif: ['var(--font-serif)'],
        mono: ['var(--font-mono)'],
      },
      fontSize: {
        // The one type scale (see DESIGN.md, Typography): every name reads
        // its size and line height from the custom properties in base.css.
        // The custom names carry weight and tracking; Tailwind's default
        // names map to the same size and line height ONLY, so a default
        // utility never changes weight. The pairing is asserted by
        // tests/build/type-scale.test.ts.
        ...step('display', { fontWeight: '600', letterSpacing: '0.025em' }),
        ...step('hero', { fontWeight: '500', letterSpacing: '0.025em' }),
        ...step('headline', { fontWeight: '500' }),
        ...step('title', { fontWeight: '500' }),
        ...step('subtitle', { fontWeight: '500' }),
        ...step('body-large', { fontWeight: '400' }),
        ...step('body', { fontWeight: '400' }),
        ...step('body-small', { fontWeight: '400' }),
        ...step('chrome', { fontWeight: '400' }),
        ...step('label', { fontWeight: '500' }),
        'uppercase-accent': [
          'var(--text-label)',
          { lineHeight: 'var(--leading-label)', fontWeight: '600', letterSpacing: '0.1em' },
        ],
        ...alias('xs', 'label'),
        ...alias('sm', 'body-small'),
        ...alias('base', 'body'),
        ...alias('lg', 'body-large'),
        ...alias('xl', 'subtitle'),
        ...alias('2xl', 'title'),
        ...alias('3xl', 'headline'),
        ...alias('4xl', 'hero'),
        ...alias('5xl', 'display'),
      },
      boxShadow: {
        'ambient': 'var(--shadow-ambient)',
        'raised': 'var(--shadow-raised)',
        'card': 'var(--shadow-card)',
        'modal': 'var(--shadow-modal)',
        'focus-ring': 'var(--shadow-focus-ring)',
        '2xs': 'var(--shadow-2xs)',
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
      },
      spacing: {
        'xxs': 'var(--spacing-xxs)',
        'xs': 'var(--spacing-xs)',
        'sm': 'var(--spacing-sm)',
        'md': 'var(--spacing-md)',
        'lg': 'var(--spacing-lg)',
        'xl': 'var(--spacing-xl)',
        '2xl': 'var(--spacing-2xl)',
        'section': 'var(--spacing-section)',
      },
      letterSpacing: {
        tight: 'var(--tracking-tight)',
        normal: 'var(--tracking-normal)',
        wide: 'var(--tracking-wide)',
      },
      transitionDuration: {
        'default': 'var(--motion-duration)',
        'fast': 'var(--motion-duration-fast)',
        'base': 'var(--motion-duration-base)',
        'slow': 'var(--motion-duration-slow)',
      },
      transitionTimingFunction: {
        'default': 'var(--motion-easing)',
        'standard': 'var(--motion-easing-standard)',
        'emphasized': 'var(--motion-easing-emphasized)',
      },
    },
  },
  plugins: [],
};
