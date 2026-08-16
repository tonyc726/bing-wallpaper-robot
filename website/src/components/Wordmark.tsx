import { memo, useState } from 'react';
import {
  MAIN_FILLS,
  MAIN_PATHS,
  MAIN_VIEW_BOX,
  SUB_DELAY_MS,
  SUB_PATH_D,
  SUB_VIEW_BOX,
  WORDMARK_CSS,
  WORDMARK_TRACE_OUT_MS,
} from '../assets/wordmark';

/**
 * 读取字标动画已经历的时长(ms)。
 * index.html 内联脚本在页面加载起点记录了 window.__wmT0,
 * React 挂载后用负 animation-delay 对齐 splash 的动画进度,实现无缝接管。
 */
export function getWordmarkElapsed(): number {
  const t0 = (window as unknown as { __wmT0?: number }).__wmT0;
  return typeof t0 === 'number' ? Date.now() - t0 : 0;
}

interface WordmarkProps {
  /** 额外指定的已进行时长(默认取页面加载起点至今) */
  elapsed?: number;
}

/**
 * 片头字标:主标题 LUMINA PAVILION(轮廓勾勒 + 逐字着墨)+ 附属标「拾影阁」(整体淡入)。
 * 与 index.html 内联 splash 共用同一份路径数据与 CSS(scripts/generate-wordmark.mjs 生成),
 * 首帧画面与 splash 完全同构。
 */
const Wordmark = memo(function Wordmark({ elapsed }: WordmarkProps) {
  // 仅在挂载时采样一次,避免重渲染导致动画进度抖动
  const [baseElapsed] = useState(() => elapsed ?? getWordmarkElapsed());

  return (
    <>
      <style>{WORDMARK_CSS}</style>
      <div
        className="wm-title"
        style={{
          // 负延迟:黑场淡入(wm-emerge)与镜头缓推(wm-pushin)与 splash 进度对齐
          animationDelay: `${-baseElapsed}ms`,
        }}
      >
        <svg
          className="wm-main"
          viewBox={MAIN_VIEW_BOX}
          role="img"
          aria-label="Lumina Pavilion"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 阶段 A:勾勒字母轮廓(实心墨色接上后,勾勒线随 wm-traceout 褪去,避免同色相叠发糊) */}
          <g className="wm-trace">
            {MAIN_PATHS.map((p, i) => {
              const fill = MAIN_FILLS.find((f) => f.char === p.char);
              return (
                <path
                  key={i}
                  d={p.d}
                  pathLength={1}
                  style={{
                    animationDuration: `${p.dur}ms,${WORDMARK_TRACE_OUT_MS}ms`,
                    // 负延迟:React 接管时直接落在 splash 动画的同一时刻
                    animationDelay: `${p.delay - baseElapsed}ms,${(fill?.fillDelay ?? 0) - baseElapsed}ms`,
                  }}
                />
              );
            })}
          </g>
          {/* 阶段 B:实心墨色逐字淡入(子路径按字合并,evenodd 规则让内孔自动镂空) */}
          <g className="wm-fill">
            {MAIN_FILLS.map((f, i) => (
              <path key={i} d={f.d} style={{ animationDelay: `${f.fillDelay - baseElapsed}ms` }} />
            ))}
          </g>
        </svg>
        {/* 附属标:拾影阁,主标题写到过半时整体浮现 */}
        <svg
          className="wm-sub"
          viewBox={SUB_VIEW_BOX}
          role="img"
          aria-label="拾影阁"
          xmlns="http://www.w3.org/2000/svg"
          style={{ animationDelay: `${SUB_DELAY_MS - baseElapsed}ms` }}
        >
          <path d={SUB_PATH_D} />
        </svg>
      </div>
    </>
  );
});

export default Wordmark;
