import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  // Add a local dev plugin to serve data from ../docs
  plugins: [
    react(),
    {
      name: 'serve-docs-data',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/chunks/')) {
            const filePath = path.resolve(__dirname, '../docs', req.url.slice(1));
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : 'application/json');
              res.end(fs.readFileSync(filePath));
              return;
            }
          }
          if (req.url === '/index.json') {
            const filePath = path.resolve(__dirname, '../docs/index.json');
            if (fs.existsSync(filePath)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(fs.readFileSync(filePath));
              return;
            }
          }
          next();
        });
      }
    },
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: "Bing 壁纸机器人",
        short_name: "Bing壁纸",
        description: "自动收集高质量Bing壁纸，每日更新，离线浏览，收藏管理",
        theme_color: "#6750A4",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "/favicon-16x16.png",
            sizes: "16x16",
            type: "image/png"
          },
          {
            src: "/favicon-32x32.png",
            sizes: "32x32",
            type: "image/png"
          },
          {
            src: "/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png"
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            // index.json and chunk jsons
            urlPattern: /.*\/index\.json|.*\/chunks\/.*\.json/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bing-wallpapers-json',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/cn\.bing\.com\/th\?.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'bing-images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 24 * 60 * 60 // 60 Days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mui: ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
