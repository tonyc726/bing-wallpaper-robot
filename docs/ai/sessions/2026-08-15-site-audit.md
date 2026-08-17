# 2026-08-15 会话交接：线上站点体检(GitHub Pages)

## 背景

对 <https://tonyc726.github.io/bing-wallpaper-robot/> 做了一次部署成果体检,工具为 Chrome DevTools MCP(导航/控制台/网络/Lighthouse/性能追踪)。

## 结论速览

- **Lighthouse(桌面+移动一致)**:A11y **89** / Best Practices 100 / SEO 100;5 项失败(4 项真实 + 1 项衍生)。
- **性能**:LCP 1831ms,其中 **98.9% 是渲染延迟**(LCP 元素是月份大标题 H1,纯文本);TTFB 仅 20ms、CLS 0。
- **控制台零报错**;`index.json` 304 缓存正常;图片走 `cn.bing.com` 全部 200。

## 发现的问题(按严重度)

### P1 可访问性(4 项,影响屏幕阅读器与弱视力用户)

| 审计项                  | 位置                                                    | 问题                                                                          |
| ----------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `aria-input-field-name` | `website/src/components/WallpaperGrid.tsx:940`          | 排序 `<Select>` 无 accessible name                                            |
| `color-contrast`        | `website/src/components/TimelineScrubber.tsx`           | `.month-tick` 文字对比度 1.1~2.48(要求 ≥4.5):橙底橙字、黑底深灰、米色底米色字 |
| `heading-order`         | `WallpaperGrid.tsx:193/249/1027`、`App.tsx:632/748/867` | 标题层级跳跃(h1→h4→h6),且每月分组各用一个 h1                                  |
| `landmark-one-main`     | `App.tsx` 整体布局                                      | 页面无 `<main>` landmark                                                      |

### P2 性能

- **LCP 渲染延迟 1.8s**:首屏内容要等 JS 启动 + `index.json` + chunk 加载后才渲染。可考虑静态骨架/首屏标题预置。
- **DOM 6822 个节点**,一次样式重算 84ms 波及 6651 元素 —— masonry 全量渲染,可考虑虚拟化。
- MUI 内部 98ms forced reflow(Popover 定位类),影响小。

### P2 数据链路风险(代码审查发现,非本次线上复现)

- `website/src/dataLoader.ts:114`:非最新月份从 npm CDN(jsdelivr→unpkg→elemecdn)`@latest` 拉 chunk,**写入 IndexedDB 时直接用 `expectedVersion` 标记,未校验 CDN 内容真实版本**。若 npm 发布滞后于 GitHub Pages 部署(工作流中 npm publish 是可选步骤),旧数据会被标成新版本缓存,长期不更新。
  - 建议:chunk 文件内嵌真实版本号并校验;或用精确版本号 `bing-wallpaper-robot@<version>` 替代 `@latest`。

## 下一步

- ✅ ~~修复 4 项 a11y~~(当日已完成并本地复测全绿,见下方「修复记录」)
- ⏳ 决定 chunk 版本校验方案(见上)。
- 性能优化(LCP/DOM 虚拟化)优先级可后置。

## 修复记录(当日完成,分支 `chore/site-audit-2026-08-15`)

| 问题         | 修法                                                                                                                                                                | 文件                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Select 无名  | `inputProps={{ 'aria-label': '排序方式' }}`                                                                                                                         | `WallpaperGrid.tsx`                                                    |
| 时间轴对比度 | 年份标签加实心小底片(`bgcolor: background.default`),idle 透明度 0.3→0.9                                                                                             | `TimelineScrubber.tsx`                                                 |
| 标题层级     | 水印 h1→装饰 `div`(aria-hidden,保留锚点 id);月份标题 `component="h2"`;卡片标题 `component="h3"`;加载/空态/弹窗/404 标题降 `component="p"`;新增视觉隐藏的页面唯一 h1 | `WallpaperGrid.tsx`、`WallpaperCard.tsx`、`App.tsx`、`ImageDialog.tsx` |
| 缺 main 地标 | 主内容 `<Box component="main">`                                                                                                                                     | `App.tsx`                                                              |

**验证**:`pnpm run build:frontend` + `build:copy` → 本地 serve `docs/` → Lighthouse 复测 **A11y/BP/SEO/Agentic 全部 100,0 失败**;标题大纲实测 `h1→h2→h3×N` 顺序正确;截图确认年份底片视觉正常。

**注意事项**:

- 本地验证时发现 vite preview 对缺失的 `index.json` 会 SPA 兜底返回 200 + HTML,导致 App 进入 404 页 —— 体检本地构建必须先 `build:copy` 再 serve `docs/`。
- 根目录 `pnpm run lint` 当前环境损坏(`eslint.config.mjs` 引用的 `typescript-eslint` 未装入 node_modules,cfd47b0 升级遗留),非本次改动引起;`pnpm install` 可恢复,且该 script 只 lint `crawler/` 不覆盖 `website/`。
- 未提交:工作树含 5 个源码改动 + `docs/` 构建产物更新 + 本文档,待用户确认后合并部署。

---

## P2 优化记录(当日完成,同分支)

### P2-1 chunk `@latest` 版本校验(数据链路风险 → 已修)

- 后端 `makePreviewJSON.ts`:chunk 与 `all.js` 内嵌 `export const v = "md5:..."`(真实内容哈希);chunk 改全量重写(内容不变 git 无 diff,一次性让 63 个 chunk 全部带版本)。
- 前端 `dataLoader.ts`:CDN 与本站源两侧都校验 `module.v === expectedVersion`;CDN 滞后/无版本 → 拒绝并降级本站;校验不过的数据**只渲染、不写 IndexedDB**,避免旧数据顶新版本号沉淀。
- 实测:CDN(jsdelivr)旧 chunk 无 `v` 被拒 → 本站源 `v` 匹配 index.json 接受,23 行数据正常。
- **过渡注意**:npm 上的旧 chunk 永不会通过校验,下次 `npm publish` 前每个旧月份多走一次降级(功能无损,控制台有 elemecdn 404 噪音);publish 后 CDN 链恢复首发命中。

### P2-2 LCP 渲染延迟(1831ms → 266ms 本地实测)

- `index.html`:`<link rel="preload" href="/index.json" as="fetch" crossorigin>` 与 JS 启动并行;静态 splash 加品牌大字「拾影阁」+ `prefers-color-scheme` 暗色适配 —— splash 大字即首屏 LCP,JS 未就绪就完成。
- `WallpaperGrid`:首月 section 传 `priority`,跳过水印 1.2s 入场动画(opacity-0 起点曾把 LCP 拖到动画结束)。
- 注:线上月份水印是 `color:transparent` 描边字,本就不计 LCP;splash 品牌字成为稳定 LCP 元素。

### P2-3 DOM 瘦身(首屏 6822 → ~1000 节点)

- **远场占位块**:未接近视口且未加载的月份,用单个按 Grid span 规则装行估算高度的占位块代替 N 个骨架节点(实测估算 vs 真实内容误差 ≤12px)。滚动懒加载、滚动监听、URL 同步全部实测正常。
- **卡片 `content-visibility: auto`**:屏外卡片跳过子树渲染。**勿加 `containIntrinsicSize`** —— 卡片靠 `aspectRatio: 16/9` 自定高,加固定 intrinsic 尺寸会导致屏外占位虚高、深链 CLS 飙到 4.89(移除后回落 0.10)。这是本次踩的最大坑。
- `TimelineScrubber` 气泡:`top` 动画 → `transform`(合成层,不再计入 CLS)。
- 顺手补漏:`PWAInstallPrompt` 的 `subtitle2`(默认渲染 h6)降 `component="p"`。

### 最终验证(本地完整部署形态)

Lighthouse:**A11y 100 / SEO 100**(BP 96 仅因过渡期 CDN 404 噪音);LCP 266ms;CLS 正常加载 0.03 / 深链 0.10(线上旧代码同场景基线 0.00,差异在 splash 换装,可接受);首屏 DOM ~1037;4 次提交在 `chore/site-audit-2026-08-15`,待合并部署。

## 复用方法

再次体检时:Chrome DevTools MCP → `new_page` → `list_console_messages` + `list_network_requests` → `lighthouse_audit`(desktop+mobile)→ `performance_start_trace`(LCP/CLS/DOM/Reflow)。
