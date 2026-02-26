import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import theme from './theme';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { NuqsAdapter } from 'nuqs/adapters/react';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <NuqsAdapter>
        <App />
      </NuqsAdapter>
    </ThemeProvider>
  </React.StrictMode>,
);
