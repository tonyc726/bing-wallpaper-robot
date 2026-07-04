# 拾影阁 · 数据采集优化方案

> 版本:v1.0 · 2026-07-03
> 范围:bing-wallpaper-robot 数据采集链路(crawler/)的能力扩展、可靠性加固与 AI 元数据增强
> 方法:deep-research 工作流检索(24 来源 / 115 条结论)+ curl 实测验证 + 本地代码与数据库审计

---

## 0. 执行摘要

当前系统只采集 Bing **单一默认市场**(请求不带 `mkt` 参数),而实测证明**同一天不同市场发布的是不同壁纸**——这是最大且最廉价的数据增量来源。此外存在一个可拿到长文描述与竖屏图的非官方富元数据接口,以及一个能回填 2010 年至今历史数据的第三方归档(本库缺 2017–2020 约三年)。去重与存储在万级规模下无需引入向量数据库;真正要修的是几处具体代码缺陷。AI 增强(语义搜索 / 打标)成本可忽略,且不必全靠多模态 LLM。

**改动优先级一句话:** 先做多市场采集(单文件改动,当天见增量)→ 修下载/去重缺陷 → 再上 AI 增强。

---

## 1. 现状盘点(代码 + 数据库实测)

### 1.1 采集链路

```
GitHub Actions (每日 18:00 UTC 单次)
  → HPImageArchive.aspx?format=js&idx=0..7&n=8  (约 15 天滑动窗口, 按 hsh 去重)
  → 下载 256px 缩略图
  → Python 分析: aHash/dHash/wHash/pHash + k-means 主色 + 4096 维 RGB 直方图
  → 三阶段去重: 汉明距离 → 颜色直方图 → SSIM
  → UHD 原图直传 ImageKit CDN
  → 写入 SQLite, 随 git 每日提交
```

滑动窗口设计是亮点(漏跑 1–2 天可自愈)。但实测暴露以下问题:

### 1.2 问题清单(带定位)

| 级别 | 问题 | 事实依据 / 代码位置 |
| --- | --- | --- |
| 🔴 数据 | **单市场盲区** | `crawler/utils/get-bing-wallpaper-info.ts:17` 请求无 `mkt`;`idx=0..7` 是回溯天数,**非** CLAUDE.md 所述"8 regions" |
| 🔴 数据 | **历史缺口** | DB 最早记录 `2020-12-18`,缺 2017–2020 约三年 |
| 🟡 质量 | **直方图预过滤失效** | `colorHist` 仅 93 / 2842 条有值(97% 存量为空),Phase 1.5 过滤对老数据形同虚设 |
| 🟡 可靠性 | **SSIM 浪费带宽** | `add-or-update-wallpaper.ts:249` 比对时从 Bing **重新下载**已有缩略图,本地 `docs/thumbs/` 已存在 |
| 🟡 可靠性 | **下载无防御** | `crawler/utils/download-image.ts:30` 不校验 HTTP 状态码、无超时,404 页面会被写成 `.jpg` |
| 🟢 完整性 | **数据孤儿** | 58 条孤儿 analytics;缩略图文件 1468 个 < imagekit 记录 1943 条(约 475 缺失) |
| 🟢 运维 | **仓库膨胀** | `.git` 已 147MB(SQLite 二进制 + 缩略图每日提交,2189 commits) |

> 实测口径(2026-07-03):`wallpaper` 2784 条 / `analytics` 2842 条 / `imagekit` 1943 条 / `colorHist` 非空 93 条 / 日期范围 20201218–20260701。

---

## 2. 研究关键结论

> ✅ = 本次 curl 实测验证(2026-07-03);其余标注来源类型,未经多重对抗验证。

### ✅ 2.1 `mkt` 参数有效,各市场同日壁纸不同
- `mkt=ja-JP` → BoneyardBeach(日文元数据);`mkt=de-DE` 同日 → FirefliesJapan(德文元数据)。
- 追加 `uhd=1&uhdwidth=3840&uhdheight=2160` 直接返回 4K 原图 URL。
- 各市场 `fullstartdate` 不同(1500 / 2200 UTC 等),更新时刻随市场时区滚动。
- 参考实现:niumoo/bing-wallpaper 采用 en-US + zh-CN 双市场 + uhd 参数。

### ✅ 2.2 非官方富元数据接口 `bing.com/hp/api/v1/imagegallery`
- `GET https://www.bing.com/hp/api/v1/imagegallery?format=json&mkt=zh-CN`
- 返回**长文 description**(百字级中文介绍)、`caption`、`clickUrl`,以及 `imageUrls` 的 6 种分辨率变体——含 HPImageArchive **没有的竖屏** `768x1366 / 1080x1920`。
- ⚠️ **稳定性风险**:无官方文档,逆向工程用法,随时可能变更/下线。**必须做降级 fallback**。

### ✅ 2.3 历史回填数据源:npanuhin/Bing-Wallpaper-Archive
- 静态 JSON API `https://bing.npanuhin.me`,2010 年起、12 市场、按 全量/国家/年/月 四级粒度。
- 实测 `US/en.2015.min.json` 可正常拉取;原图按 `/{country}/{lang}/{date}.jpg` 重新托管(均值 ~3.4MB)。
- ⚠️ 重要背景:**Bing 官方历史原图 URL 已失效**(多年前链接指向占位图),历史原图只能靠第三方归档。
- Peapix feed API(✅ 实测可用)仅 `country`/`n` 两参数,**不支持按日期查询**,不能用于回填。

### 2.4 GitHub Actions cron 漂移在恶化(官方论坛,2026-06)
- GitHub Actions PM 在社区帖承认调度负载两月涨超 30%,官方主动降低 scheduled 事件吞吐,短期无修复。
- 对策:niumoo 采用每天 3 条 cron(00:02 / 07:02 / 16:02 UTC)冗余触发。

### 2.5 去重与 AI 选型(学术 + 工程来源)
- **感知哈希对本场景够用**:2026 MDPI 论文受控对比,64-bit 感知哈希对"完全重复"检测近乎完美,弱点仅在旋转/裁剪;而多市场重复投放恰是"同图完全重复"。→ 去重**不需要** CLIP。
- **检索无需向量库**:Ultralytics 官方指南,数千张规模用 NumPy 余弦矩阵乘法即可精确检索,无需 faiss/sqlite-vec。
- **VLM 打标推荐 Qwen2.5-VL 7B**:PhotoPrism 官方基准 6 模型对比首推;纯 CPU 36s/图、幻觉率 0.33%,M4 跑增量无压力。
- **美学评分近乎免费**:LAION aesthetic = 冻结 CLIP embedding + 3.7MB MLP 头;引入 CLIP 后为零边际成本附带产物。
- **CDN/存储**:ImageKit 免费层约 20GB 带宽 + **仅 3GB 存储**(2026-06 第三方数据,需官方核实);Cloudflare R2 出站免费 + 10GB 免费存储(2026-07 官方定价)。

---

## 3. 改进路线图(按 Pareto 排序)

### P0 — 数据面:20% 改动换 80% 增量

**P0-1 多市场采集** 🔴
- 文件:`crawler/utils/get-bing-wallpaper-info.ts` / `get-multiple-bing-wallpaper-info.ts`
- 增加 `mkt` 循环,建议市场:`zh-CN, en-US, ja-JP, de-DE, fr-FR, en-GB, en-IN, pt-BR`
- 请求追加 `uhd=1&uhdwidth=3840&uhdheight=2160`
- `hsh` 去重逻辑现成,感知哈希去重管线正好消化多市场重复图
- 顺手修正 CLAUDE.md 中"8 regions"错误描述

**P0-2 富元数据双源采集** 🔴(Inversion:主备降级)
- 主源 HPImageArchive(稳定,保底);辅源 `imagegallery` 接口抓 `description` / 竖屏 URL
- 辅源失败**静默降级**,绝不阻塞主管线
- DB 新增字段:`description`(长文)、`portraitUrl`(竖屏)
- 迁移:`crawler/models/entities/Wallpaper.ts` + `pnpm run migration:generate`

**P0-3 历史回填(一次性脚本,不入主管线)** 🔴
- Bun 脚本:从 npanuhin 归档拉 2010–2020 元数据 JSON + 原图
- 走现有 `addOrUpdateWallpaper` 管线入库,复用去重
- 预期:2784 → 6000+ 条

### P1 — 可靠性:修已知缺陷

| 项 | 文件 | 动作 |
| --- | --- | --- |
| P1-1 下载防御 | `download-image.ts:30` | 校验 `statusCode===200` + 30s 超时(FMEA:防 404 污染) |
| P1-2 SSIM 免重复下载 | `add-or-update-wallpaper.ts:249` | 改读本地 `docs/thumbs/${imagekit.id}.jpg` |
| P1-3 数据修复脚本 | 一次性 | 回填 2749 条缺失 colorHist、清 58 条孤儿 analytics、补 ~475 缺失缩略图 |
| P1-4 cron 冗余 | `.github/workflows/main.yml` | 加错峰 cron(如 `23 18 * * *` + `23 22 * * *`),幂等由 hsh/filename 去重保证 |

### P2 — AI 元数据增强(见第 4 章详解)

- P2-1 CLIP embedding → 语义搜索(文搜图 / 以图搜图) + LAION 美学评分排序 —— **本地,零 token**
- P2-2 VLM(火山豆包视觉 / Qwen2.5-VL)→ 结构化中文标签 —— **可上云,成本可忽略**

---

## 4. AI 增强专章(P2 详解)

### 4.1 核心澄清:两类不同技术,别混为一谈

| 能力 | 技术 | 是否 LLM | 是否吃 token | 部署 |
| --- | --- | --- | --- | --- |
| 语义搜索(文搜图/以图搜图) | **CLIP embedding**(编码器) | 否 | 否 | 本地一次性算完存 JSON |
| 美学评分 | CLIP + MLP 头(LAION) | 否 | 否 | 搭在 CLIP 上,近零成本 |
| 打标签 / 描述 | **VLM 多模态 LLM** | 是 | 是 | 可换火山豆包 |

- **语义搜索解决的痛点**:现前端 `WallpaperGrid` 只能对 `title`/`copyright` 做关键词字符串匹配;CLIP 让"蓝色海边的日落"这类语义查询可命中标题无关键词的图。
- **检索实现**:图片向量一次性算完存 JSON,查询时用 NumPy / 浏览器端算余弦,**不引入向量库**(Occam)。

### 4.2 换火山引擎的建议

| 模块 | 换火山? | 理由 |
| --- | --- | --- |
| VLM 打标/描述 | ✅ 推荐 | `Doubao-1.5-vision-pro/lite` 对标 Qwen2.5-VL,省本地 Ollama 运维,量小价廉 |
| CLIP 语义搜索 | ❌ 不建议 | 火山有 `doubao-embedding-vision`,但本地 CLIP 近免费;上云后前端每次文搜图都要实时调 API,静态站不划算 |

**最优组合:VLM 上火山、CLIP 留本地。**

### 4.3 Token 与成本预估

最大变量是图片 token(取决于图分辨率与 detail)。以库中 **2784 条**、256–1080px 折算,取中间偏保守:
- input ≈ 1300 token/图(图 ~1100 + prompt ~200);output ≈ 200 token/图

| 场景 | Input | Output | 成本量级 |
| --- | --- | --- | --- |
| 存量一次性(2784 张) | ~3.6M | ~0.56M | **约 15–30 元** |
| 增量(去重后 ~10 张/日 ≈ 300/月) | ~0.39M/月 | ~0.06M/月 | **约 2–5 元/月** |

- 单价假设:豆包视觉约 input 3 元/百万 token、output 9 元/百万 token。
- ⚠️ **时效**:此为截至 2026-01 的记忆值,火山定价改动频繁且常有促销,**须去火山方舟控制台核实**。结论稳健:存量几十元、每月个位数,可忽略。

### 4.4 省钱的二阶分工

若已采纳 **P0-2**(拿到官方长文 description),VLM **无需再生成描述**(官方中文更准更权威),职责收窄为只输出**结构化标签**,output token 从 ~200 降到 ~50,再降一档成本。

> **精明分工:描述用官方接口(免费) · 标签用豆包(几块钱) · 搜索用本地 CLIP(免费)** —— 三者互补,无一处非多模态 LLM 不可的重复投入。

---

## 4.5 存储迁移决策:ImageKit → Cloudflare R2(2026-07-03 确认)

> 🚫 **本节已被替代(SUPERSEDED,2026-07-04)。**
> R2「主力迁移 + 双版本」方向已由**七牛云冷备份**方案取代。定位改为:
> **七牛桶只写不读,仅对冲 Bing 源头失效**;前端默认走 Bing,失效时浏览器侧
> onError 逐级降级到七牛。免费额度内**月费≈0**,无需迁移主分发、无需 sharp/avif。
> 落地见 `docs/ai/sessions/2026-07-04-qiniu-backup.md` 与 `crawler/utils/upload-to-qiniu.ts`。
>
> ⚠️ **同时更正本节 §3 存量搬运的一处前提**:经 2026-07-04 curl 实测,
> `https://cn.bing.com/th?id=<OHR>_UHD.jpg` 归档 URL 对**最老壁纸(2017)仍返回
> 11.5MB 真实 UHD 原图**(HTTP 200,非占位图)——这正是 9 年前端始终可用的原因。
> 故「不能从 Bing 重拉」不成立于本项目所用的 OHR 归档 URL;七牛回填直接从 Bing
> server-side fetch 即可(见 `crawler/backfill-qiniu.ts`),无需消耗 ImageKit 额度。
> (§2.3 所指「历史原图失效」应为 HPImageArchive 的原始 `url` 字段 / npanuhin
> 2010–2020 归档语境,与 OHR `_UHD.jpg` 归档 URL 无关。)

### 背景与定位
- ImageKit 免费层瓶颈是 **3GB DAM 存储**,已用两个账号约 80%(≈4.8GB ≈ 1943 张 UHD 原图 ×2.5MB)。**撞的是存储墙,非带宽墙**。
- 关键事实:前端图片 URL 直接指向 Bing CDN(`crawler/makePreviewJSON.ts:269-270`,`w=300`/`w=256`),**不走 ImageKit**。ImageKit 在本系统的真实角色是「UHD 原图异地备份仓库」,不是分发 CDN。
- 所以替代品要的是**便宜的对象存储**,不需要图片处理/实时变换/CDN 能力。

### 选型:Cloudflare R2
- 免费 10GB(单账号即超过两个 ImageKit 账号合计 6GB)+ egress 永久免费 + 1M Class A / 10M Class B ops。
- 超额存储 $0.015/GB/月:即便做 P0-1 多市场采集涨到 50GB,也仅 ~$0.75/月,**线性缓增而非撞墙**。
- 与项目已用的 Cloudflare Pages 同生态;备份仓库放哪不影响国内用户(分发走 `cn.bing.com`)。

### 图片优化决策:双版本 + 本地 sharp,**否决 TinyPNG**
方案:R2 存两份 —— `{id}.jpg`(Bing UHD **无损原图**,对冲 Bing 失效)+ `{id}.avif`(本地 `sharp` 生成的优化版,-30~50%,为将来自主分发预备)。

否决 TinyPNG 前置压缩的三条理由(Inversion / FMEA):
1. **有损压缩污染唯一备份**:备份的价值 = 对冲 Bing 原图失效;若上传前有损压缩,存进 R2 的即次品,Bing 一旦失效则原始画质永久丢失。备份第一原则是存无损原件。
2. **对前端零收益**:前端分发走 Bing CDN,根本不读 R2 备份图,压缩它对加载速度毫无影响。
3. **ROI 为负 + 新额度墙**:R2 存储 $0.015/GB/月,压缩省下的钱以「分/月」计;而 TinyPNG 免费仅 500 张/月(多市场采集必破,超额 $0.009/张),外加外部 API 失败点、延迟、密钥管理,违反 Occam。

本地 `sharp`(libvips)完全覆盖并优于 TinyPNG:免费无额度、无外部依赖、可离线/CI、AVIF/WebP 压缩率更高。无论目标是省空间还是备优化版,都无需引入 TinyPNG。

### 迁移步骤(待实现)
1. **改上传**:`crawler/utils/upload-to-imagekit.ts` → `upload-to-r2.ts`(用 `@aws-sdk/client-s3`,R2 全兼容 S3 API);上传原图 `{id}.jpg` + `sharp` 转码的 `{id}.avif`。
2. **实体调整**:`crawler/models/entities/Imagekit.ts` 的 `fileId` 改存 R2 object key(或新增 R2 实体 + 迁移)。
3. **存量搬运**:一次性脚本把 1943 张从 ImageKit 拉下转存 R2 —— ⚠️ **不能从 Bing 重拉**(历史原图已失效,见 §2.3)。
4. **前端**:`imageUrl`/`downloadUrl` 本就指向 Bing,**无需改动**;仅当将来要用备份图自主分发时才动。
5. **环境变量**:新增 `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`,同步进 GitHub Secrets;`upload` 需带 Tool Use 失败 fallback(重试 + 降级不阻塞主管线)。

> ✅ **取舍已定(2026-07-03)**:采用**双版本** —— R2 存 `{id}.jpg`(无损原图,对冲 Bing 失效)+ `{id}.avif`(本地 `sharp` 生成的优化版,为将来自主分发预备)。
> ⏳ **状态:待办,阻塞于用户准备 R2 账户**。账户就绪后再实现上述迁移步骤;在此之前 ImageKit 维持现状(必要时临时清理老图或暂停新增上传以缓解 80% 额度压力)。

---

## 5. 暂缓项(二阶思维:变更成本 > 收益)

| 项 | 结论 | 触发再评估的条件 |
| --- | --- | --- |
| SQLite 迁 Turso/D1 | 暂缓 | 破坏"数据随仓库自包含"哲学;3.5MB 库每日 delta 可接受。`.git` 达 ~500MB 再议 |
| ~~换掉 ImageKit~~ | **已决策 → 迁 Cloudflare R2**(见 §4.5) | 存储已触顶(两账号约 80%);R2 仅作 UHD 原图异地备份 |
| CLIP 去重 / 向量库 | 不做 | 感知哈希对"完全重复"已够;万级规模无收益(见 2.5) |

---

## 6. 建议实施顺序

1. **P0-1 多市场采集**(单文件,当天见增量)——最高性价比,先做
2. **P1-1 / P1-2**(下载防御 + SSIM 免重复下载)——低风险修缺陷,随 P0-1 一起
3. **P0-2 富元数据双源**(带迁移)——丰富元数据,为 4.4 分工铺路
4. **P0-3 历史回填**(一次性脚本)——数据量翻倍
5. **P1-3 数据修复**(一次性)——补齐 colorHist / 孤儿 / 缩略图
6. **P1-4 cron 冗余**——对冲 GitHub 调度漂移
7. **P2 AI 增强**——CLIP 本地检索 + 豆包标签
8. **⏳ R2 存储迁移(双版本,见 §4.5)**——独立轨,**阻塞于用户准备 R2 账户**;账户就绪后随时可插入,不依赖上述任何一项

---

## 附录 A · 关键接口速查

```bash
# 多市场 + 4K 原图 URL(官方稳定)
curl 'https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=ja-JP&uhd=1&uhdwidth=3840&uhdheight=2160'

# 富元数据(非官方,需 fallback)
curl 'https://www.bing.com/hp/api/v1/imagegallery?format=json&mkt=zh-CN'

# 历史回填(第三方归档,2010 起)
curl 'https://bing.npanuhin.me/US/en.2015.min.json'
```

## 附录 B · 主要来源

| 主题 | 来源 | 类型 |
| --- | --- | --- |
| HPImageArchive 逆向参数 | github.com/nikvoronin/LastWallpaper、learn.microsoft.com/answers | 社区/论坛 |
| 富元数据接口 | bing.com/hp/api/v1/imagegallery(实测) | 逆向 |
| 历史归档 | github.com/npanuhin/Bing-Wallpaper-Archive | 一手 |
| 同类项目 | github.com/niumoo/bing-wallpaper、peapix.com/api | 一手 |
| 去重选型 | mdpi.com/2079-9292/15/7/1493、docs.ultralytics.com/guides/similarity-search | 论文/官方 |
| VLM 基准 | docs.photoprism.app/developer-guide/vision/model-comparison | 官方基准 |
| 美学评分 | github.com/christophschuhmann/improved-aesthetic-predictor | 一手 |
| cron 漂移 | github.com/orgs/community/discussions/156282 | 官方论坛 |
| 存储成本 | developers.cloudflare.com/r2/pricing、d1 | 官方 |

> ⚠️ 对抗验证说明:原 deep-research 工作流的验证层因会话额度耗尽全部失败,标 ✅ 的 5 条为本地 curl 复核,其余为单来源结论,落地前建议二次核实(尤其价格/额度类)。
