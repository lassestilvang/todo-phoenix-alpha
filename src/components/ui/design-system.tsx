"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

// Color scheme types
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'pink' | 'indigo' | 'yellow';
export type ColorShade = '50' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

// Design tokens
const colorTokens = {
  blue: {
    50: 'rgba(239, 246, 255, 1)',
    100: 'rgba(219, 234, 254, 1)',
    200: 'rgba(191, 219, 254, 1)',
    300: 'rgba(147, 197, 253, 1)',
    400: 'rgba(96, 165, 250, 1)',
    500: 'rgba(59, 130, 246, 1)',
    600: 'rgba(37, 99, 235, 1)',
    700: 'rgba(29, 78, 216, 1)',
    800: 'rgba(30, 64, 175, 1)',
    900: 'rgba(30, 58, 138, 1)',
  },
  green: {
    50: 'rgba(240, 253, 244, 1)',
    100: 'rgba(220, 252, 231, 1)',
    200: 'rgba(187, 247, 208, 1)',
    300: 'rgba(134, 239, 190, 1)',
    400: 'rgba(74, 222, 128, 1)',
    500: 'rgba(34, 197, 94, 1)',
    600: 'rgba(22, 163, 74, 1)',
    700: 'rgba(21, 128, 61, 1)',
    800: 'rgba(20, 101, 52, 1)',
    900: 'rgba(20, 83, 45, 1)',
  },
  purple: {
    50: 'rgba(245, 243, 255, 1)',
    100: 'rgba(237, 232, 255, 1)',
    200: 'rgba(221, 214, 254, 1)',
    300: 'rgba(196, 181, 253, 1)',
    400: 'rgba(167, 139, 250, 1)',
    500: 'rgba(139, 92, 246, 1)',
    600: 'rgba(109, 40, 217, 1)',
    700: 'rgba(91, 33, 182, 1)',
    800: 'rgba(76, 29, 149, 1)',
    900: 'rgba(68, 26, 134, 1)',
  },
  orange: {
    50: 'rgba(255, 247, 237, 1)',
    100: 'rgba(255, 237, 213, 1)',
    200: 'rgba(254, 215, 170, 1)',
    300: 'rgba(253, 186, 116, 1)',
    400: 'rgba(251, 146, 60, 1)',
    500: 'rgba(249, 115, 22, 1)',
    600: 'rgba(234, 88, 12, 1)',
    700: 'rgba(194, 65, 12, 1)',
    800: 'rgba(154, 52, 18, 1)',
    900: 'rgba(124, 45, 18, 1)',
  },
  red: {
    50: 'rgba(254, 242, 242, 1)',
    100: 'rgba(254, 226, 226, 1)',
    200: 'rgba(254, 202, 202, 1)',
    300: 'rgba(252, 165, 165, 1)',
    400: 'rgba(248, 113, 113, 1)',
    500: 'rgba(239, 68, 68, 1)',
    600: 'rgba(220, 38, 38, 1)',
    700: 'rgba(185, 28, 28, 1)',
    800: 'rgba(153, 27, 27, 1)',
    900: 'rgba(127, 29, 29, 1)',
  },
  pink: {
    50: 'rgba(252, 241, 249, 1)',
    100: 'rgba(252, 231, 243, 1)',
    200: 'rgba(251, 213, 235, 1)',
    300: 'rgba(249, 168, 212, 1)',
    400: 'rgba(244, 114, 182, 1)',
    500: 'rgba(236, 72, 153, 1)',
    600: 'rgba(219, 39, 119, 1)',
    700: 'rgba(190, 24, 93, 1)',
    800: 'rgba(157, 23, 77, 1)',
    900: 'rgba(136, 24, 67, 1)',
  },
  indigo: {
    50: 'rgba(238, 242, 255, 1)',
    100: 'rgba(224, 231, 255, 1)',
    200: 'rgba(199, 210, 254, 1)',
    300: 'rgba(165, 180, 252, 1)',
    400: 'rgba(129, 140, 248, 1)',
    500: 'rgba(99, 102, 241, 1)',
    600: 'rgba(79, 70, 229, 1)',
    700: 'rgba(67, 56, 202, 1)',
    800: 'rgba(55, 48, 163, 1)',
    900: 'rgba(49, 46, 139, 1)',
  },
  yellow: {
    50: 'rgba(254, 252, 232, 1)',
    100: 'rgba(254, 251, 206, 1)',
    200: 'rgba(254, 249, 147, 1)',
    300: 'rgba(253, 246, 90, 1)',
    400: 'rgba(250, 204, 21, 1)',
    500: 'rgba(234, 179, 8, 1)',
    600: 'rgba(202, 138, 4, 1)',
    700: 'rgba(161, 98, 7, 1)',
    800: 'rgba(133, 77, 14, 1)',
    900: 'rgba(113, 63, 18, 1)',
  },
} as const;

// Typography
const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',  // 14px
    base: '1rem',    // 16px
    lg: '1.125rem', // 18px
    xl: '1.25rem',  // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem', // 36px
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },
} as const;

// Spacing
const spacing = {
  xs: '0.25rem',   // 4px
  sm: '0.5rem',    // 8px
  md: '0.75rem',   // 12px
  lg: '1rem',      // 16px
  xl: '1.5rem',    // 24px
  '2xl': '2rem',   // 32px
  '3xl': '3rem',   // 48px
  '4xl': '4rem',   // 64px
} as const;

// Border radius
const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  md: '0.25rem',    // 4px
  lg: '0.375rem',   // 6px
  xl: '0.5rem',     // 8px
  '2xl': '0.75rem', // 12px
  '3xl': '1rem',    // 16px
  full: '9999px',
} as const;

// Shadows
const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  none: 'none',
} as const;

// Animation durations
const animation = {
  fastest: '150ms',
  fast: '200ms',
  normal: '300ms',
  slow: '500ms',
  slowest: '1000ms',
} as const;

// Z-index
const zIndex = {
  hide: -1,
  auto: 'auto',
  base: '0',
  docked: '10',
  dropdown: '20',
  sticky: '30',
  banner: '40',
  overlay: '50',
  modal: '60',
  popover: '70',
  skipLink: '80',
  toast: '90',
  max: '1000',
} as const;

// Type definitions
interface DesignTokens {
  colors: typeof colorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  animation: typeof animation;
  zIndex: typeof zIndex;
}

interface ThemeContextType {
  theme: ColorScheme;
  setTheme: (theme: ColorScheme) => void;
  tokens: DesignTokens;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
}

// Create theme context
const DesignSystemContext = createContext<ThemeContextType | undefined>(undefined);

// Default theme
const defaultTheme: ColorScheme = 'blue';

// Theme provider
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ColorScheme;
}

export function DesignSystemProvider({ children, defaultTheme: initialTheme = defaultTheme }: ThemeProviderProps) {
  const [theme, setTheme] = useState<ColorScheme>(initialTheme);
  const [darkMode, setDarkMode] = useState(false);

  // Load saved preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('design-system-theme') as ColorScheme | null;
    const savedDarkMode = localStorage.getItem('design-system-dark-mode');

    if (savedTheme) setTheme(savedTheme);
    if (savedDarkMode !== null) setDarkMode(savedDarkMode === 'true');
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('design-system-theme', theme);
    localStorage.setItem('design-system-dark-mode', darkMode.toString());
  }, [theme, darkMode]);

  const value: ThemeContextType = {
    theme,
    setTheme,
    tokens: {
      colors: colorTokens,
      typography,
      spacing,
      borderRadius,
      shadows,
      animation,
      zIndex,
    },
    darkMode,
    setDarkMode,
  };

  return (
    <DesignSystemContext.Provider value={value}>
      {children}
    </DesignSystemContext.Provider>
  );
}

// Hook to use design tokens
export function useDesignTokens() {
  const context = useContext(DesignSystemContext);
  if (!context) {
    throw new Error('useDesignTokens must be used within a DesignSystemProvider');
  }
  return context;
}

// Utility function to get color with proper contrast
export function getColor(theme: ColorScheme, shade: ColorShade): string {
  return colorTokens[theme][shade];
}

// Component wrapper that applies design tokens
interface TokenWrapperProps {
  className?: string;
  as?: React.ElementType;
  tokens?: Partial<DesignTokens>;
}

export function TokenWrapper({ className, as = 'div', tokens, ...props }: TokenWrapperProps) {
  const Component = as as any;
  return <Component className={cn(className)} {...props} />;
}

// Dark mode utilities
export function useDarkMode() {
  const { darkMode, setDarkMode } = useDesignTokens();
  return { darkMode, setDarkMode };
}

// Theme utilities
export function useTheme() {
  const { theme, setTheme } = useDesignTokens();
  return { theme, setTheme };
}

// Helper for dynamic theme colors
export function getThemeColors(theme: ColorScheme, dark: boolean = false): {
  primary: string;
  primaryHover: string;
  primaryActive: string;
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
} {
  const primary400 = colorTokens[theme][dark ? '600' : '400'];
  const primary700 = colorTokens[theme][dark ? '800' : '700'];
  const primary500 = colorTokens[theme][dark ? '500' : '500'];

  return {
    primary: primary400,
    primaryHover: primary700,
    primaryActive: colorTokens[theme][dark ? '700' : '600'],
    background: dark ? '#1a1a1a' : 'white',
    backgroundSecondary: dark ? '#2d2d2d' : '#f5f5f5',
    text: dark ? '#ffffff' : '#1a1a1a',
    textSecondary: dark ? '#a3a3a3' : '#525252',
    border: dark ? '#404040' : '#e5e7eb',
    accent: primary500,
  };
}

export default DesignSystemProvider;