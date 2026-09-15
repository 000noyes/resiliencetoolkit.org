/**
 * The site's five breakpoints, mobile first, in CSS pixels. One source:
 * tailwind.config.mjs builds its `screens` from this map, base.css and
 * scoped styles reach the same values through `@screen` and
 * `theme(screens.<name>)`, and the scripts that watch a width import
 * this module. A width query anywhere else is a drift.
 *
 *   sm      640   cover contents in two columns; the logo word
 *   md      768   header nav; tables unstacked; the search sheet retires
 *   lg     1024   header search box always visible
 *   reading 1200  the three-column reading grid and its rails
 *   wide   1340   the header search box at its full width
 */
export const breakpoints = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
  reading: 1200,
  wide: 1340,
});

/** `(min-width: Npx)` for a named breakpoint: at or above it */
export function atOrAbove(name) {
  return `(min-width: ${breakpoints[name]}px)`;
}

/** `(max-width: N - 0.02px)` for a named breakpoint: strictly below it */
export function below(name) {
  return `(max-width: ${breakpoints[name] - 0.02}px)`;
}
