# 会话交接 · 七牛冷备份 + 前端降级链(2026-07-04)

> 目标(用户原话提炼):**图片访问默认走源头资源;七牛 CDN 仅作存储备用、自己兜底;
> 缩略图先用部署平台额度;地址不用都切到七牛云。** 按此目标调整/优化项目。

分支:`feat/qiniu-cold-backup`(从 `main` 切出)。

---

## 一、决策脉络(为什么这么做)

1. **成本估算 → 定性**:七牛「只存不发」时,存储 6GB 落在 10GB 免费额度内、
   写请求远低于免费线、CDN 下行为 0 → **月费 ≈ 0**。真正的成本项(CDN 下行)只在
   「把地址切到七牛做主分发」时才产生,而用户明确**不要**这么做。

2. **现状审计(纠正了此前基于污染读取的错误分析)**——以 sqlite/curl/磁盘为准:
   - 前端**所有**图片(缩略图 + 原图 + 下载)**早已走 Bing 源头**:
     `website/src/utils/unpackChunk.ts` 里 `imageUrl/downloadUrl = cn.bing.com/th?id=${id}_UHD.jpg`。
     所以「默认走源头」**本就是现状**。
   - **ImageKit 前端完全没用**(chunk 只有 `[id,date,title,copyright,dominantColor]` 5 字段),
     它今天就是个「只写不读」的备份 —— **正是七牛要接替/补强的角色**。
   - 真正的隐患 = **Bing 单点**:每个 URL 都指向 `cn.bing.com`,却**没有任何 fallback**。
   - 跨端契约:`makePreviewJSON.ts:263` 是 `id: filename`,即前端 chunk `id` = DB `wallpaper.filename`
     = Bing 的 OHR token。于是七牛 key `bing-wallpaper/${filename}.jpg` 与前端
     `backupUrl(id)` **天然对齐,无需改 DB schema、无需改 chunk 格式**。

3. **方案 = 打通降级链,而非搬迁**:Bing 源头 → 七牛备份 → 主色占位。
   常态 Bing 扛全部流量(七牛零流量、月费≈0),Bing 失效才切七牛。
   **省钱是副产品,修复 9 年的 Bing 单点隐患才是主收益。**

4. **替代既有 R2 规划**:用户拍板「七牛取代 R2 规划」。R2 §4.5 的「主力迁移 + sharp/avif
   双版本」方向已标注 **superseded**;七牛「只写不读」更简单、免费额度内零成本。

5. **关键实证更正(curl 实测 2026-07-04)**:§2.3/§4.5 曾断言「Bing 历史原图已失效、
   不能从 Bing 重拉」。实测最老(2017)、2021、2026 三张 `_UHD.jpg` **全部 HTTP 200
   返回真实 UHD**(最老那张 11.5MB,非占位图)。故对本项目所用的 **OHR 归档 URL**,
   「不能从 Bing 重拉」不成立 —— 回填直接从 Bing server-side fetch 即可,**无需消耗
   ImageKit 额度**。(该断言应属 HPImageArchive 原始 `url` / npanuhin 2010–2020 归档语境。)

---

## 二、已完成(本次落地)

| # | 变更 | 文件 |
| --- | --- | --- |
| 1 | 七牛冷备份封装(守卫式动态 import,未配置/未装 qiniu 时**完全惰性**,**永不 throw**;fetch-from-Bing + stat 幂等) | `crawler/utils/upload-to-qiniu.ts`(新增) |
| 2 | 采集 pipeline 集成:新图 STAGE.5 保存后新增 **STAGE.6** best-effort 备份,包裹为绝不阻断主流程 | `crawler/utils/add-or-update-wallpaper.ts` |
| 3 | 存量回填脚本(遍历全部 filename,幂等,并发 5,可重复运行) | `crawler/backfill-qiniu.ts`(新增) |
| 4 | 前端降级链:`backupUrl(id)` 读 `VITE_QINIU_DOMAIN`;卡片/大图 `onError` 插入七牛兜底层;下载失败也回退七牛;补 vite 类型 | `website/src/utils/unpackChunk.ts`、`components/{WallpaperCard,ImageDialog}.tsx`、`vite-env.d.ts` |
| 5 | 配置与文档:`.env.example` 加七牛段、标注 R2 废弃;§4.5 superseded 横幅 + 实证更正;本页看板 | `.env.example`、`plans/…§4.5`、`docs/ai/README.md` |

**设计铁律**:全链路 **inert until configured** —— 未 `pnpm add qiniu`、未配 `QINIU_*`/`VITE_QINIU_DOMAIN`
时,后端备份静默跳过、前端行为与今日**完全一致**。合入不影响每日 cron 与现有部署。

**已验证**:`website` 前端 `tsc --noEmit` 通过、`pnpm run build` 成功;pipeline 集成点已 grep 复核。
**未验证(需凭证)**:七牛真实上传/回填 —— 需用户配置后 `pnpm exec ts-node crawler/backfill-qiniu.ts` 实测。

---

## 三、下一步 / 用户需操作(激活备份)

1. **装依赖(会改 lockfile,故留给用户在合适时机做)**:`pnpm add qiniu`
   —— 未装不影响主流程(动态 import 已守卫),但备份要生效必须装。
2. **建桶 + 配密钥**:七牛控制台建 Bucket + 绑 CDN 域名;把
   `QINIU_ACCESS_KEY/SECRET_KEY/BUCKET(/ZONE)` 填进根 `.env` 与 GitHub Secrets。
3. **前端域名**:把 `VITE_QINIU_DOMAIN` 写入 `website` 构建环境(本地 `website/.env`
   或部署平台构建变量);仅此项配好,前端降级链才会启用七牛兜底。
4. **存量回填**:`pnpm exec ts-node crawler/backfill-qiniu.ts`(幂等,可重跑;
   调试可 `BACKFILL_LIMIT=50 …`)。
5. **CI 已透传**(本次已完成):`.github/workflows/main.yml` 的 `Fetch Data` 步骤已注入
   `QINIU_ACCESS_KEY/SECRET_KEY/BUCKET/ZONE`,`Make Website (Build)` 步骤已注入
   `VITE_QINIU_DOMAIN`。**你只需在 GitHub 仓库 Settings → Secrets and variables → Actions
   添加这 5 个 Secret**,每日 cron 即自动备份新图 + 线上前端启用兜底。未加 Secret 时解析为空
   → 优雅跳过,CI 不会失败。

---

## 四、注意 / 待决

- **CI frozen-lockfile**:本次**未改** `package.json`/lockfile(避免 CI `--frozen-lockfile` 失败)。
  用户 `pnpm add qiniu` 后 lockfile 会更新,再合入 CI 即可。
- **回填带宽**:七牛 `fetch` 是 server-side 抓取,本地零带宽;~1945 张一次性回填在
  免费请求额度内,失败项可幂等重跑。
- **备份覆盖范围**:STAGE.6 仅对**新建**壁纸备份(相似图复用已有记录);历史全量靠回填脚本补齐。

---

## 五、真机实测(2026-07-04,用户配置凭证后)

配置了 `QINIU_ACCESS_KEY/SECRET_KEY/BUCKET/ZONE(z0)` + `VITE_QINIU_DOMAIN` 后实测:

**✅ 已验证可用:**
- **写入**:真实备份两张(最新 + 最老)均 `status=uploaded`;复测返回 `exists` → **stat 幂等对真实桶生效**。
- **前端注入**:给 `vite.config.ts` 加了 `envDir: '../'`,前端构建直接读**根 `.env`**(单一事实来源);
  `backupUrl` 已补协议头(裸域名自动补 `https://`);构建产物**不含任何密钥**(Vite 仅暴露 VITE_ 前缀)。
- **主流程安全**:未配置时 `skipped/not-configured` 且不 throw(冒烟通过)。

**🔴 仍需用户在七牛控制台处理(否则前端兜底读取失败,但会优雅降级到占位图):**
1. **桶设为公开空间** —— 当前实测公开访问返回 **401**(私有桶)。空间设置 → 访问控制 → 公开。
2. **绑定 HTTPS 自定义 CDN 域名** —— 默认 `*.clouddn.com` **仅 HTTP**(实测 HTTPS 连接失败),
   线上 HTTPS 站点会因混合内容被拦截。绑定带 SSL 的自定义域名后,把它填入 `VITE_QINIU_DOMAIN`。

> 结论:**后端冷备份写入链路已完整打通并实测通过**;前端兜底层的"最后一公里"取决于上述
> 两项七牛账号侧配置。在此之前,前端降级链对七牛层会静默跳过(onError → 占位图),站点零影响。
