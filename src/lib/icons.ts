/**
 * Icon Utilities - Resilience Toolkit UI Design System
 *
 * Line-style icons with 1.5px stroke, rounded joins, 16px bounding box.
 * Based on Lucide icon style guide.
 *
 * Usage:
 * import { getIconProps } from '@/lib/icons';
 *
 * <svg {...getIconProps()}>
 *   <circle cx="12" cy="12" r="10" />
 * </svg>
 */

/**
 * Standard icon properties for consistent styling
 */
export interface IconProps {
  xmlns: string;
  width: number;
  height: number;
  viewBox: string;
  fill: string;
  stroke: string;
  strokeWidth: string;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
}

/**
 * Get default icon props for design system compliance
 */
export function getIconProps(size: number = 16): IconProps {
  return {
    xmlns: 'http://www.w3.org/2000/svg',
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.5',
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  };
}

/**
 * Common icon paths for the design system
 */
export const icons = {
  home: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
  }),

  search: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
      'M21 21l-4.35-4.35'
    ]
  }),

  menu: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M4 6h16',
      'M4 12h16',
      'M4 18h16'
    ]
  }),

  close: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M18 6L6 18',
      'M6 6l12 12'
    ]
  }),

  chevronRight: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M9 18l6-6-6-6'
  }),

  chevronLeft: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M15 18l-6-6 6-6'
  }),

  chevronDown: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M6 9l6 6 6-6'
  }),

  chevronUp: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M18 15l-6-6-6 6'
  }),

  check: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M20 6L9 17l-5-5'
  }),

  plus: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M12 5v14',
      'M5 12h14'
    ]
  }),

  minus: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M5 12h14'
  }),

  sun: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
      'M12 1v2',
      'M12 21v2',
      'M4.22 4.22l1.42 1.42',
      'M18.36 18.36l1.42 1.42',
      'M1 12h2',
      'M21 12h2',
      'M4.22 19.78l1.42-1.42',
      'M18.36 5.64l1.42-1.42'
    ]
  }),

  moon: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'
  }),

  settings: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z',
      'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
    ]
  }),

  user: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2',
      'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'
    ]
  }),

  mapPin: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z',
      'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
    ]
  }),

  calendar: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M16 2v4',
      'M8 2v4',
      'M3 10h18',
      'M21 8.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5z'
    ]
  }),

  alertCircle: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
      'M12 8v4',
      'M12 16h.01'
    ]
  }),

  checkCircle: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M22 11.08V12a10 10 0 1 1-5.93-9.14',
      'M22 4L12 14.01l-3-3'
    ]
  }),

  clock: (props: Partial<IconProps> = {}) => ({
    ...getIconProps(),
    ...props,
    paths: [
      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
      'M12 6v6l4 2'
    ]
  })
};

/**
 * Icon size presets
 */
export const iconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
} as const;

export type IconSize = keyof typeof iconSizes;
