# AGENTS.md — bing-wallpaper-robot

## 项目概要

**拾影阁 (Lumina Pavilion)** — 每日自动抓取 Bing 壁纸并生成静态画廊。

### 架构

```
GitHub Action (daily)
  ↓
crawler/ (Python + TypeScript) → SQLite → JSON
  ↓
website/ (React + Vite + MUI) → Static HTML
  ↓
git commit → Vercel/Netlify/Cloudflare rebuild
```

### 技术栈

- **Backend**: Node.js 22 + ts-node + TypeORM + SQLite3
- **Frontend**: React 18 + Vite 5 + MUI 5 + nuqs (URL state) + framer-motion
- **Python**: uv + Ruff + Pillow + ImageHash + scikit-image (图片分析)
- **Package**: pnpm v9+
- **CDN**: ImageKit

### 关键目录

```
.claude/            # Claude Code 专用配置
.agents/            # (如有) 通用 AI agent 配置
.claude/commands/   # Slash commands (/deploy, /fetch-bing, /test-python)
.claude/settings.json # hooks (pre-commit, post-startup)
crawler/            # 数据抓取 + Python 图片分析 (TypeScript + Python)
website/            # React 前端应用 (Vite + MUI)
database/           # SQLite 数据库文件
docs/               # 构建输出目录 (static HTML)
```

### 常用命令

```bash
# 安装依赖
pnpm install
cd crawler && uv sync

# 前端开发
pnpm run dev                    # localhost:3000

# 数据抓取
pnpm run fetch-data             # 只抓数据
pnpm run build                  # 完整构建

# 代码质量
pnpm run format:lint            # 格式化 + lint

# Python 脚本 (直接调试)
cd crawler && uv run python getImageHash.py <image_path>
cd crawler && uv run python dominantColor.py <image_path>
```

### 环境变量

`.env` 文件中需要 `IMAGEKIT_PUBLIC_KEY`、`IMAGEKIT_PRIVATE_KEY`、`IMAGEKIT_URL_ENDPOINT`。

### 代码规范

- **TypeScript**: 严格模式，禁止 `any`，PascalCamelCase 类型 / camelCase 变量
- **Python**: 类型注解必填，docstring，Google 风格
- **Commit**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`)
- **Package**: 始终用 `pnpm`，禁止 `npm`
- **Python**: 始终用 `uv` 管理依赖

### Python 脚本

`crawler/` 下的 4 个脚本通过 `uv run python` 执行：
- `getImageHash.py` — 计算 4 种感知哈希 (aHash, dHash, wHash, pHash)
- `dominantColor.py` — k-means 提取主色
- `computeColorHist.py` — 4096 维 RGB 颜色直方图
- `ssim-compare.py` — SSIM 结构相似度

### 数据库

SQLite: `database/bing-wallpaper.sqlite`
3 个实体: Wallpaper (UUID PK), Analytics (哈希+颜色), Imagekit (CDN 元数据)

### 部署

GitHub Actions 每日 18:00 UTC 自动提交到 main，触发 Vercel/Netlify/Cloudflare Pages 重新构建。
