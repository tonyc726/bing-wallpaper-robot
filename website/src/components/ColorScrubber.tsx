import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, useTheme, alpha, useMediaQuery } from '@mui/material';
import { getColorFilterHex } from '../theme';
import type { ColorCategory } from '../utils/colorUtils';

interface ColorProps {
  colors: ColorCategory[]; // ['红色系', '蓝色系', ...]
  onScrubRequest?: (color: string) => void;
}

const ColorScrubber = ({ colors, onScrubRequest }: ColorProps) => {
  const [activeColor, setActiveColor] = useState<string>('');
  const [hoverColor, setHoverColor] = useState<string>('');
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // === 颜色到展示颜色的映射关系 ===
  const getColorHex = (cat: string) => {
    // 优先使用统一的色彩筛选器配置
    const centralizedColor = getColorFilterHex(cat);
    if (centralizedColor) return centralizedColor;

    // 无彩色 (黑白灰)
    if (cat === '无彩色 (黑白灰)') {
      return theme.palette.mode === 'dark' ? '#d1d5db' : '#4b5563';
    }

    return theme.palette.text.primary;
  };

  // 1. 侦测滚动，高亮色系
  useEffect(() => {
    if (isDragging) return; 

    // 将 color id 到 DOM 元素的映射提前构建，避免每帧 getElementById
    const elCache = new Map<string, HTMLElement>();
    for (const col of colors) {
      const id = `month-${col}`;
      const el = document.getElementById(id);
      if (el) elCache.set(col, el);
    }

    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        let closestColor = '';
        let minDistance = Infinity;

        for (const [col, el] of elCache) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && Math.abs(rect.top) < minDistance) {
            minDistance = Math.abs(rect.top);
            closestColor = col;
          }
        }

        if (closestColor) {
          setActiveColor(prev => prev !== closestColor ? closestColor : prev);
        } else if (colors.length > 0) {
          setActiveColor(prev => prev !== colors[0] ? colors[0] : prev);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // 初始化执行一次
    const timer = setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [colors, isDragging]);

  // 2. 滚至具体色彩区块
  const scrollToColor = useCallback((color: string) => {
    if (onScrubRequest) {
      onScrubRequest(color);
    } else {
      // Fallback
      const id = `month-${color}`;
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'instant' }); 
      }
    }
  }, [onScrubRequest]);

  // 3. 处理拖拽与点击 (Scrubbing)
  const handlePointerEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!trackRef.current || colors.length === 0) return;
    
    // 如果在拖拽，阻止原生行为
    if (e.type === 'pointermove' && isDragging && e.cancelable) {
      e.preventDefault();
    }

    const rect = trackRef.current.getBoundingClientRect();
    // 限制 Y 在 track 范围内
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const percentage = y / rect.height;
    
    // 计算对应的 index
    let index = Math.floor(percentage * colors.length);
    if (index >= colors.length) index = colors.length - 1;
    if (index < 0) index = 0;

    const targetColor = colors[index];

    if (e.type === 'pointermove') {
      setHoverColor(targetColor);
      if (isDragging && targetColor !== activeColor) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
           navigator.vibrate(10);
        }
        setActiveColor(targetColor);
        scrollToColor(targetColor);
      }
    } else if (e.type === 'pointerdown') {
      setIsDragging(true);
      setActiveColor(targetColor);
      setHoverColor(targetColor);
      scrollToColor(targetColor);
      // 捕获 pointer
      if (e.pointerId) {
        try {
          trackRef.current.setPointerCapture(e.pointerId);
        } catch (err) {
          // 忽略失效的 pointerId
        }
      }
    } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
      setIsDragging(false);
      if (e.pointerId) {
        try {
          trackRef.current.releasePointerCapture(e.pointerId);
        } catch (err) {
          // 忽略失效的 pointerId
        }
      }
    }
  }, [colors, isDragging, activeColor, scrollToColor]);

  // 全局 touchmove 禁用，以解决移动设备上的拖拽穿透
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (isDragging && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => document.removeEventListener('touchmove', preventDefault);
  }, [isDragging]);


  if (colors.length === 0) return null;

  const displayColor = isHovering || isDragging ? (hoverColor || activeColor) : activeColor;
  const displayIndex = colors.indexOf(displayColor as any);
  const bubbleTopPercent = colors.length > 0 ? ((displayIndex + 0.5) / colors.length) * 100 : 50;

  return (
    <Box
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoverColor(''); }}
      sx={{
        position: 'fixed',
        top: '50%',
        right: { xs: 8, md: 16 }, 
        transform: 'translateY(-50%)',
        height: '50vh', // 比时光轴稍短一点
        width: 64, 
        zIndex: 1200,
        display: { xs: 'flex', lg: 'flex' }, 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        touchAction: 'none', 
      }}
    >
      {/* 极简流体吸附文字 (Hovering Text)  */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          right: { xs: 32, md: 48 }, 
          top: `calc(${bubbleTopPercent}% - ${isMobile ? '60px' : '0px'})`, 
          transform: 'translateY(-50%)',
          color: getColorHex(displayColor) || (theme.palette.mode === 'dark' ? '#fff' : '#000'),
          fontWeight: 800, 
          opacity: isHovering || isDragging ? 0.9 : 0, 
          transition: isDragging 
            ? 'none' 
            : 'top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s', 
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 1201,
          fontSize: { xs: '1rem', md: '1.25rem' }, 
          letterSpacing: '-0.02em',
          textShadow: theme.palette.mode === 'dark' 
            ? `0 4px 24px ${alpha(getColorHex(displayColor) || '#ffffff', 0.4)}, 0 1px 3px rgba(0,0,0,1)`
            : `0 4px 24px ${alpha(getColorHex(displayColor) || '#000000', 0.2)}, 0 1px 3px rgba(255,255,255,1)`,
        }}
      >
        {displayColor}
      </Typography>

      {/* 沉浸式交互轨道 (Track)  */}
      <Box
        ref={trackRef}
        onPointerDown={handlePointerEvent}
        onPointerMove={handlePointerEvent}
        onPointerUp={handlePointerEvent}
        onPointerCancel={handlePointerEvent}
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'pointer',
        }}
      >
        {
          colors.map((color, index) => {
          const isActive = activeColor === color;
          
          let distanceScale = 1;
          let distanceOpacity = 0.3; // 默认稍亮一些以显示颜色
          let translateX = 0;
          const diff = Math.abs(index - displayIndex);
          
          if (isHovering || isDragging) {
            if (diff === 0) {
              distanceScale = 3.5; 
              distanceOpacity = 1;
              translateX = -8;
            } else if (diff === 1) {
              distanceScale = 2; 
              distanceOpacity = 0.8;
              translateX = -5;
            } else if (diff === 2) {
              distanceScale = 1.2;
              distanceOpacity = 0.5;
              translateX = -2;
            }
          } else {
            if (isActive) {
              distanceScale = 2;
              distanceOpacity = 1;
            }
          }

          const dotColor = getColorHex(color);

          return (
            <Box
              key={color}
              className="color-tick"
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flex: 1,
                position: 'relative',
                pr: 1,
                pointerEvents: 'none', 
              }}
            >
              <Box
                sx={{
                  width: 4,  // 色块稍微比白点大一些
                  height: 4, 
                  borderRadius: '50%',
                  bgcolor: dotColor,
                  opacity: distanceOpacity,
                  transform: `translateX(${translateX}px) scale(${distanceScale})`,
                  transition: isDragging ? 'transform 0.1s, opacity 0.1s' : 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transformOrigin: 'right center',
                  boxShadow: diff === 0 && (isHovering || isDragging) 
                    ? `0 0 12px 2px ${dotColor}` 
                    : 'none', 
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ColorScrubber;
