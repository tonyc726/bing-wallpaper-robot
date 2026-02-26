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
    h1: { fontSize: '2.5rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em' },
    body1: { fontSize: '1rem', letterSpacing: '0.01em' },
    body2: { fontSize: '0.875rem', letterSpacing: '0.01em' },
    button: { textTransform: 'none' as const, fontWeight: 500 },
  },
  shape: {
    borderRadius: 16, // 更大的圆角
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
      default: '#0A0A0A', // 极深的夜黑，非纯黑
      paper: '#121212',
    },
    text: {
      primary: '#FAFAFA',
      secondary: '#A1A1AA',
    },
    divider: 'rgba(255, 255, 255, 0.08)',
  },
});

export const lightTheme = createTheme({
  ...coreThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#1D1D1F', // Apple dark text color
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#86868B', // Apple secondary text color
    },
    background: {
      default: '#F5F5F7', // macOS system light gray
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1D1D1F',
      secondary: '#86868B',
    },
    divider: 'rgba(0, 0, 0, 0.06)', // Softer divider
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
