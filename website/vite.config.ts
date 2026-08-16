import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Base path strategy (multi-environment):
 *
 *  VITE_BASE_URL env var   → use that value (CI can inject per-platform)
 *  development mode        → '/' (local dev always root)
 *  otherwise               → './' (relative path for multi-platform compatibility)
 *
 * Using relative path './' ensures the app works on:
 * - Root domain (Vercel, Netlify, Cloudflare, custom domain)
 * - Subpath (GitHub Pages: /bing-wallpaper-robot/)
 *
 * The trade-off: Service Worker scope is limited to the deployment path.
 */
export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE_URL || (mode === 'development' ? '/' : './');

  return {
    // Add a local dev plugin to serve data from ../docs
    plugins: [
      react(),
      {
        name: 'serve-docs-data',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.startsWith('/chunks/')) {
              const filePath = path.resolve(import.meta.dirname, '../docs', req.url.slice(1));
              if (fs.existsSync(filePath)) {
                res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript' : 'application/json');
                res.end(fs.readFileSync(filePath));
                return;
              }
            }
            if (req.url === '/index.json') {
              const filePath = path.resolve(import.meta.dirname, '../docs/index.json');
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
          name: "拾影阁 · Lumina Pavilion",
          short_name: "拾影阁",
          description: "收藏世界的光影 — 极简纯粹的数字壁纸画廊",
          theme_color: "#000000",
          background_color: "#000000",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
          orientation: "portrait-primary",
          // PWA scope: always use relative path for cross-platform compatibility
          start_url: '.',
          scope: '.',
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
              name: "浏览最新馆藏",
              short_name: "最新馆藏",
              description: "查看最新归档的壁纸",
              url: ".?action=latest",
              icons: [{ src: "android-chrome-192x192.png", sizes: "192x192" }]
            }
          ],
          screenshots: [
            {
              src: "android-chrome-512x512.png",
              sizes: "512x512",
              type: "image/png",
              label: "拾影阁主界面"
            }
          ]
        },
        workbox: {
          navigationPreload: false,
          // 排除 chunks 和 index.json，不让 NavigationRoute 拦截这些请求
          navigateFallbackDenylist: [
            /^\/chunks\//,       // 动态加载的 chunk 数据
            /^\/index\.json/,    // 索引文件
          ],
          globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,webp,woff2}'],
          // 清理脚本通过 importScripts 注入即可,无需进入 precache 清单
          globIgnores: ['sw-cleanup.js'],
          // 注入遗留 runtime cache 清理逻辑(generateSW 只自动清理 precache)
          importScripts: ['sw-cleanup.js'],
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
              // 缩略图(w=300):体积小、命中频率高,可适当多缓存。
              // 注意:必须注册在全尺寸规则之前,Workbox 按注册顺序先匹配先生效。
              urlPattern: /^https:\/\/cn\.bing\.com\/th\?.*[?&]w=300(&|$)/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bing-thumbs-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // 全尺寸大图(预览/下载):单张 1~4MB,且跨域 opaque 响应
              // 在 Chrome Cache Storage 配额统计中会被显著放大(历史约 7MB/条),
              // 复看率又低,必须严格限量 —— 这是 Cache Storage 膨胀的主因。
              urlPattern: /^https:\/\/cn\.bing\.com\/th\?.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'bing-images-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 7 * 24 * 60 * 60 // 7 Days
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
    // 从仓库根目录读取 .env（与后端共用同一份 .env，单一事实来源）。
    // 安全性：Vite 仅把 VITE_ 前缀变量暴露给前端，QINIU_SECRET_KEY 等密钥不会进产物。
    envDir: path.resolve(import.meta.dirname, '..'),
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: true,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'vendor', test: /node_modules\/(?:react|react-dom)\// },
              { name: 'mui', test: /node_modules\/(?:@mui|@emotion)\// },
              { name: 'motion', test: /node_modules\/framer-motion\// },
            ],
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      port: 3000,
      open: true,
    },
  };
});
