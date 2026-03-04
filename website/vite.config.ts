import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';

/**
 * Base path strategy (multi-environment):
 *
 *  VITE_BASE_URL env var   → use that value (CI can inject per-platform)
 *  development mode        → '/' (local dev always root)
 *  otherwise               → '/'  (Vercel / Netlify / Cloudflare / custom domain all serve at root)
 *
 * For GitHub Pages only (subpath deploy), the GitHub Actions workflow
 * must pass `VITE_BASE_URL=/bing-wallpaper-robot/` at build time.
 */
export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_URL || (mode === 'development' ? '/' : '/');

  return {
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
        injectRegister: false,
        manifest: {
          name: "Horizon (地平线)",
          short_name: "Horizon",
          description: "Horizon - 自动收集高质量壁纸，每日更新，离线浏览，收藏管理",
          theme_color: "#000000",
          background_color: "#000000",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
          orientation: "portrait-primary",
          start_url: base === '/' ? '/' : base,
          scope: base === '/' ? '/' : base,
          lang: "zh-CN",
          dir: "ltr",
          categories: ["photography", "entertainment", "lifestyle"],
          icons: [
            {
              src: "favicon-16x16.png",
              sizes: "16x16",
              type: "image/png"
            },
            {
              src: "favicon-32x32.png",
              sizes: "32x32",
              type: "image/png"
            },
            {
              src: "android-chrome-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "android-chrome-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable"
            },
            {
              src: "apple-touch-icon.png",
              sizes: "180x180",
              type: "image/png"
            }
          ],
          shortcuts: [
            {
              name: "浏览最新壁纸",
              short_name: "最新壁纸",
              description: "查看最新添加的壁纸",
              url: base === '/' ? '/?action=latest' : `${base}?action=latest`,
              icons: [{ src: "android-chrome-192x192.png", sizes: "192x192" }]
            },
            {
              name: "我的收藏",
              short_name: "收藏",
              description: "查看收藏的壁纸",
              url: base === '/' ? '/?action=favorites' : `${base}?action=favorites`,
              icons: [{ src: "android-chrome-192x192.png", sizes: "192x192" }]
            }
          ],
          screenshots: [
            {
              src: "android-chrome-512x512.png",
              sizes: "512x512",
              type: "image/png",
              label: "Horizon 主界面"
            }
          ]
        },
        workbox: {
          navigationPreload: false,
          globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,webp,woff2}'],
          runtimeCaching: [
            {
              // index.json and chunk jsons/js (NPM CDN)
              urlPattern: /.*\/(index\.json|chunks\/.*\.(json|js))/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'bing-wallpapers-data',
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
    base,
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
  };
});
