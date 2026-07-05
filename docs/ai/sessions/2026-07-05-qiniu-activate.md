# 会话交接 · 七牛冷备份激活核验(2026-07-05)

## 背景

用户配置好 HTTPS 域名 `https://bing-wallpapers-qiniu.itony.net` 后告知,本会话对七牛冷备份 + 前端降级链做**端到端激活核验**。

## 核验结论(全绿)

| 项 | 状态 | 证据 |
| --- | --- | --- |
| `.env` 凭证 | ✅ | AK/SK/Bucket=`bing-wallpapers`/Zone=`z0` + `VITE_QINIU_DOMAIN` 均已填 |
| `qiniu` 包 | ✅ | `package.json` `^7.15.2`,`node_modules/qiniu` 在位 |
| key 契约对齐 | ✅ | 后端 `bing-wallpaper/${filename}.jpg`;前端 `id`==`filename`(makePreviewJSON L263 `id: filename`)→ `backupUrl(id)` 完全对齐 |
| 桶已全量回填 | ✅ | 抽查「最老 2 条(date ASC)+ 中段 + 最新 3 条」共 7 张,HTTPS Range GET 全 `206` 带真实字节 |
| HTTPS 公开可读 | ✅ | `Content-Type: image/jpeg`,无 401 / 无混合内容拦截 |
| 前端 env 读取 | ✅ | `website/vite.config.ts` `envDir` 指向仓库根 → 构建读 `../.env` |
| 域名内联产物 | ✅ | 本地 `pnpm run build` 后 `website/dist/assets/*.js` 内含 `bing-wallpapers-qiniu.itony.net/bing-wallpaper` |
| GitHub Secrets | ✅ | `gh secret list`:QINIU_ACCESS_KEY/SECRET_KEY/BUCKET/ZONE + VITE_QINIU_DOMAIN(2026-07-05 03:39 新增)5 项齐 |

## 唯一遗留:部署平台环境变量(🔴 需用户操作)

`VITE_QINIU_DOMAIN` 是 **build-time 内联**变量。当前缺口:

1. **GitHub Action 每日构建**:Secret 已齐 → 下次(每日 18:00 UTC)构建会把域名烤进 `docs/` 并提交,该路径自动激活。
2. **Vercel**:`vercel.json` `buildCommand = pnpm install && pnpm run build`,**自行重建前端**。需在 Vercel 项目环境变量里加 `VITE_QINIU_DOMAIN`,否则 Vercel 域名的兜底层不激活。
3. **Netlify**:`netlify.toml` 自行重建(`build:frontend + build:copy`),`[build.environment]` 目前**只有 `VITE_BASE_URL`**。需补 `VITE_QINIU_DOMAIN`。
4. **Cloudflare**:按其构建方式(重建则同样需配环境变量;若纯托管已提交 `docs/` 则随 Action 产物激活)。

> 注:当前线上已提交的 `docs/` 构建于配置域名之前,`grep` 无域名 → **线上兜底层现处未激活态**,等各构建路径带上变量后的下一次构建激活。降级链设计为 inert-until-configured,未激活期间前端行为与今日完全一致(无副作用)。

## 下一步

- 用户在 Vercel / Netlify(必要时 Cloudflare)后台补配 `VITE_QINIU_DOMAIN`。
- 触发一次重建(或等每日 Action),再 `grep docs/assets/*.js` 复验线上激活。
