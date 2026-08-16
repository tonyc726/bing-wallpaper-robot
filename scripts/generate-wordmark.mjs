/**
 * generate-wordmark.mjs
 *
 * 生成首屏加载字标动画资源(OFL 字体置于 scripts/fonts/,不入库):
 *   主标题  LUMINA PAVILION(Marcellus,罗马石刻大写)—— 轮廓勾勒 + 逐字墨色淡入
 *   附属标  拾影阁(MaShanZheng,毛笔)—— 主标题写到过半时整体淡入
 *
 * 产物:
 *   1. website/src/assets/wordmark.ts  —— 轮廓子路径 + 时间轴 + 共享 CSS(React 侧使用)
 *   2. 注入 website/index.html         —— 内联 splash(JS 就绪前的首帧画面)
 *
 * 动画模型(电影片头字幕式):
 *   阶段 A trace:主标题每个字母以 pathLength=1 的 stroke-dashoffset 从左到右勾出轮廓
 *   阶段 B fill :字母轮廓将尽时实心墨色淡入(子路径按字合并 + evenodd,内孔自动镂空),
 *                勾勒线同步褪去(wm-traceout),避免同色相叠发糊
 *   附属标 fade :拾影阁不勾勒,仅在主标题写到约 55% 时整体浮现
 *
 * 用法: node scripts/generate-wordmark.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ========== 参数 ==========
const MAIN_FONT = 'Marcellus';
const MAIN_TEXT = 'LUMINA PAVILION';
const SUB_FONT = 'MaShanZheng';
const SUB_TEXT = '拾影阁';
const SIZE = 1024; // 渲染字号(坐标基准)
const PAD = 48; // viewBox 内边距
const TRACE_WIDTH = 7; // 勾勒墨线宽度(主标题坐标单位)
const TRACE_START_MS = 120; // 首笔起步时刻(留给黑场淡入一点呼吸)
const TARGET_TRACE_MS = 2000; // 主标题勾勒阶段目标总时长
const SUBPATH_GAP_MS = 12; // 子路径之间的停顿
const FILL_DUR_MS = 650; // 墨色淡入时长
const FILL_OVERLAP_MS = 140; // 填充相对勾勒结束的提前量(笔锋未停墨已晕)
const TRACE_OUT_MS = 320; // 勾勒线褪去时长(实心墨色接上后淡出,避免同色相叠发糊)
const SUB_FADE_DUR_MS = 800; // 附属标淡入时长
const SUB_START_RATIO = 0.55; // 附属标在主标题时间轴上的入场位置

const fontPath = (name) => path.join(ROOT, 'scripts/fonts', `${name}-Regular.ttf`);
for (const name of [MAIN_FONT, SUB_FONT]) {
  if (!fs.existsSync(fontPath(name))) {
    console.error(`✘ 字体不存在: ${fontPath(name)}\n  请先下载 OFL 字体到 scripts/fonts/`);
    process.exit(1);
  }
}
const loadFont = (name) => opentype.parse(fs.readFileSync(fontPath(name)).buffer);

// ========== 字形 → 子路径(按 M 指令拆分,控制多边形近似估长) ==========
function splitSubpaths(glyphPath) {
  const subpaths = [];
  let cur = null;
  let px = 0;
  let py = 0;
  let sx = 0;
  let sy = 0; // 子路径起点(用于 Z 闭合)
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  for (const cmd of glyphPath.commands) {
    if (cmd.type === 'M') {
      cur = { d: `M ${cmd.x} ${cmd.y}`, len: 0, minX: cmd.x };
      subpaths.push(cur);
      sx = cmd.x;
      sy = cmd.y;
    } else if (cmd.type === 'L') {
      cur.d += ` L ${cmd.x} ${cmd.y}`;
      cur.len += dist(px, py, cmd.x, cmd.y);
      cur.minX = Math.min(cur.minX, cmd.x);
    } else if (cmd.type === 'Q') {
      cur.d += ` Q ${cmd.x1} ${cmd.y1} ${cmd.x} ${cmd.y}`;
      cur.len += dist(px, py, cmd.x1, cmd.y1) + dist(cmd.x1, cmd.y1, cmd.x, cmd.y);
      cur.minX = Math.min(cur.minX, cmd.x1, cmd.x);
    } else if (cmd.type === 'C') {
      cur.d += ` C ${cmd.x1} ${cmd.y1} ${cmd.x2} ${cmd.y2} ${cmd.x} ${cmd.y}`;
      cur.len +=
        dist(px, py, cmd.x1, cmd.y1) + dist(cmd.x1, cmd.y1, cmd.x2, cmd.y2) + dist(cmd.x2, cmd.y2, cmd.x, cmd.y);
      cur.minX = Math.min(cur.minX, cmd.x1, cmd.x2, cmd.x);
    } else if (cmd.type === 'Z') {
      cur.d += ' Z';
      cur.len += dist(px, py, sx, sy);
    }
    if (cmd.x !== undefined) {
      px = cmd.x;
      py = cmd.y;
    }
  }
  return subpaths;
}

// 逐字 x 偏移(字宽 + 字距),与整串 getPath 的排版结果一致
function advanceOffsets(font, text) {
  const offsets = [];
  let xAcc = 0;
  const scale = SIZE / font.unitsPerEm;
  for (let i = 0; i < text.length; i++) {
    offsets.push(xAcc);
    let kern = 0;
    if (i < text.length - 1) {
      kern = font.getKerningValue(font.charToGlyph(text[i]), font.charToGlyph(text[i + 1])) * scale;
    }
    xAcc += font.getAdvanceWidth(text[i], SIZE) + kern;
  }
  return offsets;
}

const viewBoxOf = (bb) => {
  const vbX = Math.floor(bb.x1 - PAD);
  const vbY = Math.floor(bb.y1 - PAD);
  const vbW = Math.ceil(bb.x2 - bb.x1 + PAD * 2);
  const vbH = Math.ceil(bb.y2 - bb.y1 + PAD * 2);
  return `${vbX} ${vbY} ${vbW} ${vbH}`;
};

// ========== 主标题:LUMINA PAVILION(勾勒 + 逐字着墨) ==========
const mainFont = loadFont(MAIN_FONT);
for (const ch of MAIN_TEXT) {
  if (ch !== ' ' && mainFont.charToGlyphIndex(ch) === 0) {
    console.error(`✘ 字体 ${MAIN_FONT} 缺少字符: ${ch}`);
    process.exit(1);
  }
}
// viewBox 取整串排版的整体包围盒
const MAIN_VIEW_BOX = viewBoxOf(mainFont.getPath(MAIN_TEXT, 0, 0, SIZE).getBoundingBox());

// 逐字生成轮廓:每个字的子路径天然归属自己,不做按坐标归桶。
// (负左承距的字形如 Marcellus 的 A,外沿会越过字距起点,按 minX 归桶
//  会把外轮廓错划给前一字母、内孔单独成桶,evenodd 失效导致内孔被填实)
const mainSubpaths = [];
{
  const offsets = advanceOffsets(mainFont, MAIN_TEXT);
  for (let c = 0; c < MAIN_TEXT.length; c++) {
    if (MAIN_TEXT[c] === ' ') continue;
    const gp = mainFont.getPath(MAIN_TEXT[c], offsets[c], 0, SIZE);
    for (const s of splitSubpaths(gp)) {
      s.char = c;
      mainSubpaths.push(s);
    }
  }
}

// 排时间
const sumLen = mainSubpaths.reduce((a, s) => a + s.len, 0);
const k = (TARGET_TRACE_MS - mainSubpaths.length * SUBPATH_GAP_MS) / sumLen;
let t = TRACE_START_MS;
const mainTraces = mainSubpaths.map((s) => {
  const dur = Math.max(50, Math.min(400, Math.round(s.len * k)));
  const entry = { d: s.d, delay: Math.round(t), dur, char: s.char };
  t += dur + SUBPATH_GAP_MS;
  return entry;
});

// 实心墨色按字合并:一条 path + evenodd,内孔自动镂空;
// 填充时机 = 该字最后一笔勾勒将尽时(笔锋未停墨已晕)
const mainFills = [];
for (let c = 0; c < MAIN_TEXT.length; c++) {
  const parts = mainTraces.filter((s) => s.char === c);
  if (!parts.length) continue; // 空格等无轮廓字符
  const lastEnd = Math.max(...parts.map((s) => s.delay + s.dur));
  mainFills.push({
    d: parts.map((s) => s.d).join(' '),
    fillDelay: Math.round(lastEnd - FILL_OVERLAP_MS),
    char: c,
  });
}
const MAIN_TOTAL_MS = Math.max(...mainFills.map((f) => f.fillDelay)) + FILL_DUR_MS;

// ========== 附属标:拾影阁(整体淡入,不勾勒) ==========
const subFont = loadFont(SUB_FONT);
for (const ch of SUB_TEXT) {
  if (subFont.charToGlyphIndex(ch) === 0) {
    console.error(`✘ 字体 ${SUB_FONT} 缺少字符: ${ch}`);
    process.exit(1);
  }
}
const subGlyphPath = subFont.getPath(SUB_TEXT, 0, 0, SIZE);
const SUB_VIEW_BOX = viewBoxOf(subGlyphPath.getBoundingBox());
const SUB_PATH_D = subGlyphPath.toPathData(2);
const SUB_DELAY_MS = Math.round(MAIN_TOTAL_MS * SUB_START_RATIO);

const TOTAL_MS = Math.max(MAIN_TOTAL_MS, SUB_DELAY_MS + SUB_FADE_DUR_MS);

// ========== 共享 CSS(splash 内联 & React <style> 同源) ==========
// 胶片质感层:黑场淡入(wm-emerge)+ 镜头缓推(wm-pushin)+ 颗粒抖动(wm-grain)+ 暗角(wm-vignette)
// 全部为 transform/opacity 动画,GPU 合成,移动端安全
const GRAIN_URI = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
const WORDMARK_CSS = `
.wm-title{display:flex;flex-direction:column;align-items:center;gap:clamp(12px,3vw,20px);animation:wm-emerge .9s ease-out both,wm-pushin 8s cubic-bezier(.22,1,.36,1) both}
.wm-main{display:block;width:clamp(240px,64vw,520px);height:auto}
.wm-sub{display:block;width:clamp(88px,22vw,132px);height:auto;opacity:0;animation:wm-sub-in ${SUB_FADE_DUR_MS}ms ease-out both}
.wm-sub path{fill:currentColor;fill-rule:evenodd}
.wm-trace path{fill:none;stroke:currentColor;stroke-width:${TRACE_WIDTH};stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation-name:wm-draw,wm-traceout;animation-timing-function:cubic-bezier(.45,.05,.35,1),ease;animation-fill-mode:forwards,forwards}
.wm-fill path{fill:currentColor;fill-rule:evenodd;opacity:0;animation:wm-fillin ${FILL_DUR_MS}ms ease-out both}
@keyframes wm-emerge{from{opacity:0}to{opacity:1}}
@keyframes wm-pushin{from{transform:scale(1)}to{transform:scale(1.045)}}
@keyframes wm-sub-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes wm-draw{to{stroke-dashoffset:0}}
@keyframes wm-traceout{to{stroke-opacity:0}}
@keyframes wm-fillin{to{opacity:1}}
.wm-line{position:relative;width:min(220px,52vw);height:2px;border-radius:1px;overflow:hidden;background:var(--wm-line-track,rgba(17,17,17,.1));color:inherit;animation:wm-emerge .9s ease-out .35s both}
.wm-line-bar{display:block;height:100%;background:currentColor;border-radius:1px}
.wm-line-indeterminate{width:40%;animation:wm-slide 1.1s cubic-bezier(.45,.05,.55,.95) infinite}
.wm-line-determinate{width:100%;transform-origin:left center;transform:scaleX(var(--wm-p,0));transition:transform .3s ease}
@keyframes wm-slide{from{transform:translateX(-100%)}to{transform:translateX(260%)}}
.wm-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 120% 90% at 50% 45%,transparent 55%,var(--wm-vignette,rgba(93,78,55,.12)) 100%)}
.wm-grain{position:absolute;top:-50%;left:-50%;width:200%;height:200%;pointer-events:none;opacity:.055;background:${GRAIN_URI};animation:wm-grain-jitter .9s steps(8) infinite}
@keyframes wm-grain-jitter{0%{transform:translate(0,0)}12.5%{transform:translate(-2%,1%)}25%{transform:translate(1%,-2%)}37.5%{transform:translate(-1%,2%)}50%{transform:translate(2%,1%)}62.5%{transform:translate(-2%,-1%)}75%{transform:translate(1%,2%)}87.5%{transform:translate(2%,-2%)}100%{transform:translate(0,0)}}
/* 等宽小字注脚:呼应画廊 mono 标签语言(ERROR_CODE / 2026 竖排) */
.wm-progress{display:flex;flex-direction:column;align-items:center;gap:12px}
.wm-caption{font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;letter-spacing:.35em;text-transform:uppercase;opacity:0;animation:wm-caption-in 1.2s ease-out 1.2s forwards}
@keyframes wm-caption-in{to{opacity:.5}}
@media (prefers-reduced-motion:reduce){
.wm-title{animation:none}
.wm-sub{animation:none;opacity:1}
.wm-trace path{animation:none;stroke-dashoffset:0;stroke-opacity:0}
.wm-fill path{animation:none;opacity:1}
.wm-line{animation:none}
.wm-line-indeterminate{animation-duration:2.4s}
.wm-line-determinate{transition:none}
.wm-grain{animation:none}
.wm-caption{animation:none;opacity:.5}
}`.trim();

// ========== splash 专用布局 CSS(仅 index.html) ==========
// 暗色判定与 App.tsx 的 darkMode 初始化逻辑一致:
// localStorage 有偏好用偏好;无偏好时仅系统明确 light 才用亮色,否则默认暗色。
// 由下方内联脚本在首帧前给 <html> 打 wm-dark 标记,CSS 据此反相,保证 splash → React 无闪切。
const SPLASH_LAYOUT_CSS = `
.app-loading{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;min-height:100vh;background:radial-gradient(ellipse 130% 100% at 50% 45%,#fdfdfc 0%,#f2f0ec 100%);color:#111;--wm-line-track:rgba(17,17,17,.1);--wm-vignette:rgba(93,78,55,.12)}
html.wm-dark .app-loading{background:radial-gradient(ellipse 130% 100% at 50% 45%,#101010 0%,#000 78%);color:#f5f5f5;--wm-line-track:rgba(245,245,245,.14);--wm-vignette:rgba(0,0,0,.55)}`.trim();

const SPLASH_BOOT_SCRIPT = `<script>window.__wmT0 = window.__wmT0 || Date.now();try{var __wmSaved = localStorage.getItem('darkMode');var __wmDark = __wmSaved !== null ? JSON.parse(__wmSaved) : !window.matchMedia('(prefers-color-scheme: light)').matches;if (__wmDark) document.documentElement.classList.add('wm-dark');}catch(e){}</script>`;

// ========== 生成 SVG 标记(splash 内联版) ==========
const fillDelayOfChar = (c) => mainFills.find((f) => f.char === c)?.fillDelay ?? 0;
const tracePaths = mainTraces
  .map(
    (s) =>
      `<path d="${s.d}" pathLength="1" style="animation-duration:${s.dur}ms,${TRACE_OUT_MS}ms;animation-delay:${s.delay}ms,${fillDelayOfChar(s.char)}ms"/>`,
  )
  .join('');
const fillPaths = mainFills.map((f) => `<path d="${f.d}" style="animation-delay:${f.fillDelay}ms"/>`).join('');
const MAIN_SVG = `<svg class="wm-main" viewBox="${MAIN_VIEW_BOX}" role="img" aria-label="${MAIN_TEXT}" xmlns="http://www.w3.org/2000/svg"><g class="wm-trace">${tracePaths}</g><g class="wm-fill">${fillPaths}</g></svg>`;
const SUB_SVG = `<svg class="wm-sub" viewBox="${SUB_VIEW_BOX}" role="img" aria-label="${SUB_TEXT}" xmlns="http://www.w3.org/2000/svg" style="animation-delay:${SUB_DELAY_MS}ms"><path d="${SUB_PATH_D}"/></svg>`;

const SPLASH_HTML = `<div class="app-loading"><div class="wm-vignette"></div><div class="wm-title">${MAIN_SVG}${SUB_SVG}</div><div class="wm-progress"><div class="wm-line"><i class="wm-line-bar wm-line-indeterminate"></i></div><div class="wm-caption">Collecting Light · Since 2017</div></div><div class="wm-grain"></div></div>`;

// ========== 产物 1:website/src/assets/wordmark.ts ==========
const ts = `/* eslint-disable */
// 本文件由 scripts/generate-wordmark.mjs 自动生成,请勿手改
// 字形来源:${MAIN_FONT} / ${SUB_FONT}(SIL OFL 许可)
export interface WordmarkPath {
  /** 字形子路径(轮廓,仅用于勾勒描边) */
  d: string;
  /** 勾勒动画延迟(ms,相对页面加载起点) */
  delay: number;
  /** 勾勒动画时长(ms) */
  dur: number;
  /** 所属字序号(用于对齐墨线褪去时机) */
  char: number;
}

export interface WordmarkFill {
  /** 按字合并后的完整字形(含内孔轮廓,配合 fill-rule:evenodd 镂空) */
  d: string;
  /** 实心墨色淡入延迟(ms,相对页面加载起点) */
  fillDelay: number;
  /** 所属字序号(用于对齐勾勒线褪去时机) */
  char: number;
}

/** 主标题 ${MAIN_TEXT} */
export const MAIN_VIEW_BOX = '${MAIN_VIEW_BOX}';
export const MAIN_PATHS: WordmarkPath[] = ${JSON.stringify(mainTraces, null, 2)};
export const MAIN_FILLS: WordmarkFill[] = ${JSON.stringify(mainFills, null, 2)};

/** 附属标 ${SUB_TEXT}(整体淡入) */
export const SUB_VIEW_BOX = '${SUB_VIEW_BOX}';
export const SUB_PATH_D = ${JSON.stringify(SUB_PATH_D)};
export const SUB_DELAY_MS = ${SUB_DELAY_MS};

export const WORDMARK_TOTAL_MS = ${TOTAL_MS};
export const WORDMARK_TRACE_OUT_MS = ${TRACE_OUT_MS};

export const WORDMARK_CSS = ${JSON.stringify(WORDMARK_CSS)};
`;
fs.mkdirSync(path.join(ROOT, 'website/src/assets'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'website/src/assets/wordmark.ts'), ts);

// ========== 产物 2:注入 website/index.html ==========
const htmlPath = path.join(ROOT, 'website/index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const inject = (source, tag, content) => {
  const re = new RegExp(`(<!-- wm:${tag}:start -->)[\\s\\S]*?(<!-- wm:${tag}:end -->)`);
  if (!re.test(source)) throw new Error(`index.html 缺少标记 wm:${tag}:start/end`);
  return source.replace(re, `$1\n${content}\n      $2`);
};

html = inject(
  html,
  'style',
  `      ${SPLASH_BOOT_SCRIPT}\n      <style>\n${SPLASH_LAYOUT_CSS}\n${WORDMARK_CSS}\n      </style>`,
);
html = inject(html, 'splash', `      ${SPLASH_HTML}`);

fs.writeFileSync(htmlPath, html);

console.log(
  `✔ 生成字标:主标题「${MAIN_TEXT}」(${MAIN_FONT},${mainTraces.length} 条子路径)+ 附属标「${SUB_TEXT}」(${SUB_FONT}),总时长 ${TOTAL_MS}ms`,
);
console.log(`  → website/src/assets/wordmark.ts`);
console.log(`  → website/index.html (wm:style / wm:splash 标记块)`);
