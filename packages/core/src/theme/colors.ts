// packages/core/src/theme/colors.ts
export const palette = {
  primary: {
    900: "#0B1F3A",
    700: "#1D4ED8",
    500: "#3B82F6",
    100: "#DBEAFE",
  },
  accent: {
    600: "#D97706",
    400: "#FBBF24",
    100: "#FEF3C7",
  },
  live: {
    600: "#0D9488",
    100: "#CCFBF1",
  },
  neutral: {
    950: "#0F1115",
    800: "#1F2329",
    200: "#E5E7EB",
    50: "#F9FAFB",
    900: "#111827",
  },
  semantic: {
    success: "#16A34A",
    warning: "#CA8A04",
    error: "#DC2626",
  },
} as const;

// Define specific theme structures for Light and Dark modes
export const lightTheme = {
  background: palette.neutral[50],
  surface: "#FFFFFF",
  text: palette.neutral[900],
  textSecondary: "#6B7280",
  primary: palette.primary[700],
  accent: palette.accent[600],
  live: palette.live[600],
  border: palette.neutral[200],
};

export const darkTheme = {
  background: palette.neutral[950],
  surface: palette.neutral[800],
  text: "#FFFFFF",
  textSecondary: "#9CA3AF",
  primary: palette.primary[500],
  accent: palette.accent[400],
  live: palette.live[600],
  border: palette.neutral[800],
};

export type Palette = typeof palette;
export type Theme = typeof lightTheme;
