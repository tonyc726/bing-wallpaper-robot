import { memo, useState } from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import Wordmark, { getWordmarkElapsed } from './Wordmark';

interface LoadingScreenProps {
  /** 0-100;0 或 100 时显示不定态滑光 */
  progress: number;
}

/**
 * 加载页:与 index.html 内联 splash 完全同构的画面(暗角 + 颗粒 + 字标 + 细进度线),
 * React 挂载后无缝接管书写动画,数据就绪后由 AnimatePresence 统一退场(片尾字幕式溶解)。
 */
const LoadingScreen = memo(function LoadingScreen({ progress }: LoadingScreenProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const isDark = theme.palette.mode === 'dark';
  const showDeterminate = progress > 0 && progress < 100;
  // 仅在挂载时采样一次:用于对齐 splash 阶段动画进度
  const [elapsed] = useState(getWordmarkElapsed);

  return (
    <Box
      component={motion.div}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.03, y: -16 }}
      transition={{ duration: reduceMotion ? 0.25 : 0.7, ease: [0.22, 1, 0.36, 1] }}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        // 与 splash 的 gap:40px 保持一致
        gap: '40px',
        minHeight: '100vh',
        // 与 splash 内联 CSS 完全一致:银幕中心微光的径向渐变底
        background: isDark
          ? 'radial-gradient(ellipse 130% 100% at 50% 45%, #101010 0%, #000 78%)'
          : 'radial-gradient(ellipse 130% 100% at 50% 45%, #fdfdfc 0%, #f2f0ec 100%)',
        color: isDark ? '#f5f5f5' : '#111111',
        // 与 splash 内联 CSS 变量保持一致(WORDMARK_CSS 消费)
        '--wm-ink-from': isDark ? '#6f6f6f' : '#b5b5b5',
        '--wm-ink-to': isDark ? '#f5f5f5' : '#111111',
        '--wm-line-track': isDark ? 'rgba(245,245,245,.14)' : 'rgba(17,17,17,.1)',
        '--wm-vignette': isDark ? 'rgba(0,0,0,.55)' : 'rgba(93,78,55,.12)',
      }}
    >
      {/* 电影暗角(与 splash 同层同参数) */}
      <Box className="wm-vignette" />
      <Wordmark />
      <Box className="wm-progress">
        <div
          className="wm-line"
          role="progressbar"
          aria-label="数据加载进度"
          style={{ animationDelay: `${350 - elapsed}ms` }}
        >
          {showDeterminate ? (
            <i className="wm-line-bar wm-line-determinate" style={{ ['--wm-p' as string]: progress / 100 }} />
          ) : (
            <i className="wm-line-bar wm-line-indeterminate" />
          )}
        </div>
        {showDeterminate ? (
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
              fontFamily: '"JetBrains Mono", "Courier New", monospace',
              letterSpacing: '0.1em',
            }}
          >
            {Math.round(progress)}%
          </Typography>
        ) : (
          <div className="wm-caption" style={{ animationDelay: `${1200 - elapsed}ms` }}>
            Collecting Light · Since 2017
          </div>
        )}
      </Box>
      {/* 胶片颗粒:置于最上层,覆盖字标,营造放映感 */}
      <Box className="wm-grain" />
    </Box>
  );
});

export default LoadingScreen;
