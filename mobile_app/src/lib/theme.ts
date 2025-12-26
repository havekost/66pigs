// 66 Pigs Theme - Fun and friendly for all ages
export const colors = {
  // Primary colors - warm pink pig theme
  primary: '#FF6B9D',
  primaryDark: '#E85A8A',
  primaryLight: '#FFB3CC',

  // Secondary colors - friendly teal
  secondary: '#4ECDC4',
  secondaryDark: '#3AB5AD',
  secondaryLight: '#7EDDD6',

  // Accent colors
  accent: '#FFE66D',
  accentDark: '#FFD93D',

  // Background colors
  background: '#FFF5F7',
  backgroundDark: '#FFEEF2',
  card: '#FFFFFF',

  // Text colors
  textPrimary: '#2D3436',
  textSecondary: '#636E72',
  textLight: '#B2BEC3',
  textOnPrimary: '#FFFFFF',

  // Status colors
  success: '#00B894',
  warning: '#FDCB6E',
  error: '#FF7675',

  // Game-specific colors
  pigPink: '#FF6B9D',
  cardBorder: '#DFE6E9',
  tableGreen: '#55A578',
  goldHighlight: '#FFD700',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  giant: 48,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
};

export const theme = {
  colors,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
};

export type Theme = typeof theme;
