# 会话交接:首屏片头字标动画(2026-08-16)

> 分支:`feat/wordmark-loading-animation`(未合并 main)
> 主题:把「splash → 数据加载 → 画廊入场」三段割裂的加载体验,统一成一场电影片头式的字标演出。

## 决策脉络(按用户反馈迭代)

1. **起点**:旧加载是两段割裂画面(白底 spinner splash → 渐变底 CircularProgress),用户要求统一渐变、移动端优先。
2. **字标书写动画**:用户从备选方案中选了「字标书写动画」。最初实现是 hanzi-writer 笔顺(mask + median),后弃用(`hanzi-writer-data` 依赖已移除)。
3. **电影质感**:加黑场淡入(`wm-emerge`)、镜头缓推(`wm-pushin` 8s scale 1→1.045)、胶片颗粒(feTurbulence data-URI + steps(8) 抖动)、暗角(`wm-vignette`)。
4. **字体选型**:楷体太生硬 → 换 **马善政毛笔(MaShanZheng, OFL)**;备选智芒行草(ZhiMangXing)已下载可切换。
5. **层级对调**(最终形态):动画主体改为拉丁字标 **LUMINA PAVILION(Marcellus,罗马石刻大写,OFL)**,逐字轮廓勾勒 + 着墨;**「拾影阁」降为附属标**,在主标题时间轴 55% 处整体淡入,不再勾勒。
6. 移除了背景 LUMINA 大水印(与主标题重复);mono 注脚「Collecting Light · Since 2017」保留,呼应画廊编辑排版语言。

## 技术架构

- **单一数据源**:`scripts/generate-wordmark.mjs`(opentype.js 解析字体轮廓)→ 产出
  - `website/src/assets/wordmark.ts`(子路径 + 时间轴 + 共享 CSS + TOTAL_MS)
  - 注入 `website/index.html` 的 `<!-- wm:style/splash:start/end -->` 标记块(内联 splash)
- **无缝接管**:`index.html` 内联 boot 脚本记录 `window.__wmT0` 并按 localStorage/系统偏好预打 `html.wm-dark`(逻辑与 App.tsx darkMode 初始化一致,防主题闪切);React 挂载后用**负 animation-delay** 对齐 splash 动画进度。
- **动画模型**:trace(`pathLength=1` + dashoffset 1→0 逐子路径勾勒)→ fill(子路径**按字合并**为一条 path + `fill-rule:evenodd`,该字末笔将尽时淡入)→ traceout(勾勒线 320ms 褪去,避免同色描边压着字形发糊)。
- **最小演出时长**:`App.tsx` 用 `WORDMARK_TOTAL_MS + 400ms` 兜底,数据过快返回也不闪切;退场/入场走 framer-motion `AnimatePresence mode="wait"`。
- **无障碍/性能**:全部 transform/opacity/dashoffset(GPU 合成);`prefers-reduced-motion` 下直接呈现最终态;`clamp()/min()` 响应式。

## 踩过的坑(重要)

- **内孔填实**:字形按 M 指令拆成独立子路径后逐条 fill,内孔(口/日/A 的三角 counter)会被涂成实心墨团。必须**同字合并 + evenodd** 才会镂空。
- **负左承距归桶失败**:曾按轮廓 `minX` 把子路径归桶到字母区间,Marcellus 的 A 外沿越过字距起点,外轮廓错划给前一字母、内孔单独成桶 → A 三角被填实。修法:**逐字 `getPath`** 生成轮廓,归属天然正确,不做坐标归桶。
- **描边发糊**:勾勒线 `forwards` 停留在完成的字形上,同色描边压着 fill 像光晕 → 加 `wm-traceout` 让勾勒线在着墨时淡出。
- **viewBox 裁切**:书法字形的提按会超出字号框,viewBox 必须用轮廓实际 bbox + PAD,不能写死。

## 已完成

- 生成器、Wordmark.tsx、LoadingScreen.tsx、App.tsx 接线、index.html 注入、暗/亮 + 移动端(390×844, Slow 4G)浏览器验证全通过
- `hanzi-writer-data` 依赖移除;`scripts/fonts/` 已加入 .gitignore(OFL 字体可再下载,不入库)
- `pnpm format:lint` + website tsc 通过

## 下一步

- 合并 `feat/wordmark-loading-animation` → main 后随站点部署生效
- 若想换附属标风格:`node scripts/generate-wordmark.mjs` 改 `SUB_FONT='ZhiMangXing'` 重新生成即可(字体已在本机 scripts/fonts/)
- ⚠️ 本分支工作区还有一批**与本特性无关的 prettier 格式化改动**(crawler/、.claude/、plans/ 等,来自会话中一次 `pnpm format:lint`),未随本特性提交,需用户决定单独提交或丢弃

## 注意

- `scripts/fonts/` 不入库;CI 或他人重新生成字标时需先下载 OFL 字体(生成器会报错提示)
- 本目录随站点公开部署,勿写入密钥
