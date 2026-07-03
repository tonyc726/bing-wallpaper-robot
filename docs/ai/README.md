# 🤝 AI 协作文档区

> 本目录存放 **Jiangfeng × Claude** 的协作文档:研究纪要、决策记录、会话交接。
> 目的:让任意一次新会话都能快速接上上下文,无缝继续未完成的工作。

---

## ⚠️ 三条须知

1. **构建安全**:`docs/` 是站点构建产物目录,但 `scripts/copy-build.mjs` 只清理白名单外的**根级文件**与 `assets/`,**非白名单目录(含本 `ai/`)一律原样保留**。因此本目录不会被 `pnpm run build` 覆盖或删除。
2. **会随站点公开部署**:`docs/ai/` 会被 Vercel/Netlify/Cloudflare 一并发布,URL 可被访问(虽无页面入口链接)。**请勿在此写入任何密钥或敏感凭证**。如需私有化,见文末。
3. **不影响前端**:前端只加载 `index.json` / `wallpapers.json`,不会读取本目录,故对页面功能零影响。

---

## 📊 进度看板(截至 2026-07-03)

| 状态 | 事项 | 备注 |
| --- | --- | --- |
| ✅ 已完成 | 数据采集改进**深度研究** + 方案文档 | 见 [`plans/`](../../plans/data-collection-optimization.md) |
| ✅ 已完成 | `.env.example`(占位 + R2 预留) | 已提交(见 `git log`) |
| ✅ 已完成 | **P1-1** 下载防御加固 | `download-image.ts` / `download-thumbnail.ts` |
| ✅ 已完成 | **P1-2** SSIM 复用本地缩略图 | `add-or-update-wallpaper.ts` |
| ⏸️ 暂缓 | **P0-1** 多市场采集 | 会加速 ImageKit 撞满,**待 R2 就绪后再做** |
| ⏳ 待办 | **P0-2** 富元数据双源 / **P0-3** 历史回填 | 见方案 §3 |
| ⏳ 待办 | **P1-3** 数据修复 / **P1-4** cron 冗余 | 见方案 §3 |
| ⏳ 待办 | **P2** AI 增强(CLIP 检索 + 豆包打标) | 见方案 §4 |
| 🔴 阻塞 | **R2 双版本备份迁移** | 阻塞于用户准备 R2 账户 |
| 🔴 待决策 | ImageKit 撞满的**上传失败降级** | 牵涉前端数据流(`makePreviewJSON` 从 imagekit 表出发) |

---

## 🗂️ 文档索引

| 文档 | 用途 |
| --- | --- |
| [`../../plans/data-collection-optimization.md`](../../plans/data-collection-optimization.md) | **主方案**:现状审计 + 研究结论 + 分级路线图 + R2/AI 决策 |
| [`sessions/2026-07-03-数据采集优化.md`](sessions/2026-07-03-数据采集优化.md) | 本次会话交接:决策脉络、已完成、下一步 |

---

## 🚀 新会话快速上手

1. **读本页看板** → 了解整体进度与阻塞点。
2. **读 [主方案](../../plans/data-collection-optimization.md)** → 掌握完整设计与优先级。
3. **看最新一篇 [session](sessions/)** → 了解上次会话的决策与交接。
4. **确认分支**:工作在 `docs/data-collection-optimization`(已提交并 push,**未合并 main**;以 `git log` / `git ls-remote` 为准)。
5. **继续**:直接说「继续优化」,并从看板选一个 ⏳ 待办项。注意 🔴 阻塞项需先解除前置条件。

---

## 🗺️ 关键文件地图(数据采集链路)

| 关注点 | 文件 |
| --- | --- |
| 采集入口 / 市场循环 | `crawler/utils/get-bing-wallpaper-info.ts`、`get-multiple-bing-wallpaper-info.ts` |
| 5 阶段入库 + 三阶段去重 | `crawler/utils/add-or-update-wallpaper.ts` |
| 图片下载(已加固) | `crawler/utils/download-image.ts`、`download-thumbnail.ts` |
| CDN 上传(待迁 R2) | `crawler/utils/upload-to-imagekit.ts` |
| 前端数据生成 | `crawler/makePreviewJSON.ts` |
| 构建拷贝(保留规则) | `scripts/copy-build.mjs` |

---

## 🔗 关联

- **项目记忆**:`~/.claude/projects/-Users-zhujiangfeng-Playground-bing-wallpaper-robot/memory/`(核心决策已存档,新会话自动加载索引)。
- **如需私有化本目录**:可在 `docs/_headers` 对 `/ai/*` 加访问控制,或改为存放在仓库根的 `docs/` 之外(但那样就不随站点部署)。
