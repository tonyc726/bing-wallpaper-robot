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

// 基于暗色模式优先的专业画廊设计
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
    borderRadius: 24, // 极其圆润的流体胶囊基础
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
          borderRadius: 24, // 药丸形按钮
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
          backgroundImage: 'none', // 移除默认的白光层
          boxShadow: 'none', // 扁平化，阴影靠自身定义
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
          '&.Mui-selected': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
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

export const darkTheme = createTheme({
  ...coreThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFFFFF', // 暗色模式下主色调为纯白，更克制高级
      contrastText: '#000000',
    },
    secondary: {
      main: '#A1A1AA',
    },
    background: {
      default: '#000000', // OLED 原黑
      paper: 'rgba(20, 20, 20, 0.6)', // 极度通透的纸面
    },
    text: {
      primary: '#FFFFFF', // 纯白
      secondary: 'rgba(255, 255, 255, 0.6)',
    },
    divider: 'rgba(255, 255, 255, 0.04)', // 更不可见的分割线
  },
});

export const lightTheme = createTheme({
  ...coreThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#000000', // 纯黑
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#86868B', // Apple secondary text color
    },
    background: {
      default: '#FFFFFF', // 霜白原生背景
      paper: 'rgba(255, 255, 255, 0.7)', // 透光的轻纸张
    },
    text: {
      primary: '#000000',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
    divider: 'rgba(0, 0, 0, 0.04)', // 几不可见的微弱切割
  },
  components: {
    ...coreThemeOptions.components,
    MuiToggleButton: {
      styleOverrides: {
        root: {
          ...coreThemeOptions.components.MuiToggleButton.styleOverrides?.root,
          '&.Mui-selected': {
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            color: '#1D1D1F',
          },
        },
      },
    },
  },
});

export default darkTheme; // 默认深色
