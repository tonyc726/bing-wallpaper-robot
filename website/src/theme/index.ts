import { createTheme, alpha, type Theme } from '@mui/material/styles';

const FONT_FAMILY = [
  'Inter',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(',');

// ============================================
// 统一配色系统 (Unified Color System)
// ============================================

/** 强调色 - Bing 品牌蓝 */
const ACCENT = {
  light: '#0078D4',
  main: '#0078D4',
  dark: '#005A9E',
} as const;

/** 功能色 */
const STATUS = {
  error: {
    light: '#f87171',
    main: '#ef4444',
    dark: '#dc2626',
  },
  success: {
    light: '#4ade80',
    main: '#22c55e',
    dark: '#16a34a',
  },
  warning: {
    light: '#fbbf24',
    main: '#f59e0b',
    dark: '#d97706',
  },
  info: {
    light: '#60a5fa',
    main: '#3b82f6',
    dark: '#2563eb',
  },
} as const;

/** 色彩筛选器 - Tailwind 风格 */
const COLOR_FILTERS = [
  { name: '红色系', hex: '#ef4444' },
  { name: '橙色系', hex: '#f97316' },
  { name: '黄色系', hex: '#eab308' },
  { name: '绿色系', hex: '#22c55e' },
  { name: '青色系', hex: '#06b6d4' },
  { name: '蓝色系', hex: '#3b82f6' },
  { name: '紫色系', hex: '#a855f7' },
  { name: '粉色系', hex: '#ec4899' },
] as const;

/** 渐变配置 */
const GRADIENTS = {
  loading: {
    dark: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
    light: 'linear-gradient(135deg, #f8f9fc 0%, #e8ecf1 100%)',
  },
  overlay: {
    dark: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    light: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  },
} as const;

/** 装饰光晕 */
const GLOW = {
  accent: {
    dark: 'rgba(0, 120, 212, 0.15)',
    light: 'rgba(0, 90, 158, 0.1)',
  },
} as const;

/** 背景层级 */
const BACKDROP = {
  card: {
    dark: 'rgba(30, 30, 40, 0.7)',
    light: 'rgba(255, 255, 255, 0.8)',
  },
  overlay: {
    dark: 'rgba(5, 5, 5, 0.98)',
    light: 'rgba(255, 255, 255, 0.95)',
  },
  glass: {
    dark: 'rgba(255, 255, 255, 0.1)',
    light: 'rgba(0, 0, 0, 0.05)',
  },
} as const;

// ============================================
// 主题扩展类型
// ============================================

declare module '@mui/material/styles' {
  interface Palette {
    accent: typeof ACCENT;
    status: typeof STATUS;
    gradients: typeof GRADIENTS;
    glow: typeof GLOW;
    backdrop: typeof BACKDROP;
    colorFilters: typeof COLOR_FILTERS;
  }
  interface PaletteOptions {
    accent?: typeof ACCENT;
    status?: typeof STATUS;
    gradients?: typeof GRADIENTS;
    glow?: typeof GLOW;
    backdrop?: typeof BACKDROP;
    colorFilters?: typeof COLOR_FILTERS;
  }
}

// ============================================
// 导出颜色工具函数
// ============================================

/** 获取色彩筛选器的颜色 */
export function getColorFilterHex(colorName: string): string {
  return COLOR_FILTERS.find((c) => c.name === colorName)?.hex ?? '';
}

/** 统一导出色彩筛选器配置 */
export { COLOR_FILTERS };

// ============================================
// 主题配置
// ============================================

const coreThemeOptions = {
  typography: {
    fontFamily: FONT_FAMILY,
    h1: { fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 800, letterSpacing: '-0.04em' },
    h2: { fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.03em' },
    h3: { fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.02em' },
    h4: { fontSize: 'clamp(1.25rem, 2vw, 1.5rem)', fontWeight: 600, letterSpacing: '-0.01em' },
    body1: { fontSize: '1rem', letterSpacing: '0.01em', lineHeight: 1.6 },
    body2: { fontSize: '0.875rem', letterSpacing: '0.02em', lineHeight: 1.5 },
    button: { textTransform: 'none' as const, fontWeight: 600, letterSpacing: '0.02em' },
  },
  shape: {
    borderRadius: 24,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: (theme: Theme) => ({
        body: {
          transition: 'background-color 0.4s ease',
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(theme.palette.text.primary, 0.2),
            borderRadius: '4px',
            '&:hover': {
              background: alpha(theme.palette.text.primary, 0.4),
            },
          },
        },
      }),
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24,
          padding: '8px 24px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
        },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          border: 'none',
          borderRadius: '16px !important',
          margin: '0 4px',
          padding: '6px 16px',
        },
      },
    },
    MuiToggleButtonGroup: {
      styleOverrides: {
        root: {
          border: 'none',
          '& .MuiToggleButtonGroup-grouped': {
            margin: '0 4px',
            border: 'none !important',
            borderRadius: '16px !important',
          },
        },
      },
    },
  },
};

// --------------------------------------------
// 暗色主题
// --------------------------------------------

export const darkTheme = createTheme({
  ...coreThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFFFFF',
      contrastText: '#000000',
    },
    secondary: {
      main: '#A1A1AA',
    },
    background: {
      default: '#000000',
      paper: 'rgba(20, 20, 20, 0.6)',
    },
    text: {
      primary: '#FFFFFF',
      secondary: 'rgba(255, 255, 255, 0.6)',
    },
    divider: 'rgba(255, 255, 255, 0.04)',
    // 扩展配色
    accent: ACCENT,
    status: STATUS,
    gradients: GRADIENTS,
    glow: GLOW,
    backdrop: BACKDROP,
    colorFilters: COLOR_FILTERS,
  },
  components: {
    ...coreThemeOptions.components,
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...coreThemeOptions.components.MuiToggleButton?.styleOverrides?.root,
          '&.Mui-selected': {
            backgroundColor: alpha('#FFFFFF', 0.1),
          },
        },
      },
    },
  },
});

// --------------------------------------------
// 亮色主题
// --------------------------------------------

export const lightTheme = createTheme({
  ...coreThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#000000',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#86868B',
    },
    background: {
      default: '#FFFFFF',
      paper: 'rgba(255, 255, 255, 0.7)',
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
    divider: 'rgba(0, 0, 0, 0.04)',
    // 扩展配色
    accent: {
      light: '#3399DD',
      main: '#005A9E',
      dark: '#004578',
    },
    status: STATUS,
    gradients: {
      loading: {
        dark: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        light: 'linear-gradient(135deg, #f8f9fc 0%, #e8ecf1 100%)',
      },
      overlay: GRADIENTS.overlay,
    },
    glow: {
      accent: {
        dark: 'rgba(0, 120, 212, 0.15)',
        light: 'rgba(0, 90, 158, 0.1)',
      },
    },
    backdrop: {
      card: {
        dark: 'rgba(30, 30, 40, 0.7)',
        light: 'rgba(255, 255, 255, 0.8)',
      },
      overlay: {
        dark: 'rgba(5, 5, 5, 0.98)',
        light: 'rgba(255, 255, 255, 0.95)',
      },
      glass: {
        dark: 'rgba(255, 255, 255, 0.1)',
        light: 'rgba(0, 0, 0, 0.05)',
      },
    },
    colorFilters: COLOR_FILTERS,
  },
  components: {
    ...coreThemeOptions.components,
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...coreThemeOptions.components.MuiToggleButton?.styleOverrides?.root,
          '&.Mui-selected': {
            backgroundColor: alpha('#000000', 0.05),
            color: '#1D1D1F',
          },
        },
      },
    },
  },
});

export default darkTheme;
