import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

interface TimelineProps {
  months: string[]; // ['2025年02月', '2025年01月', ...]
  onScrubRequest?: (month: string) => void;
}

const TimelineScrubber = ({ months, onScrubRequest }: TimelineProps) => {
  const [activeMonth, setActiveMonth] = useState<string>('');
  const [hoverMonth, setHoverMonth] = useState<string>('');
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const theme = useTheme();

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // 1. 侦测滚动，高亮年月
  useEffect(() => {
    if (isDragging) return; // 拖拽时由拖拽主导
    const handleScroll = () => {
      let closestMonth = '';
      let minDistance = Infinity;

      for (const month of months) {
        const id = `month-${month.replace('年', '-').replace('月', '')}`;
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && Math.abs(rect.top) < minDistance) {
            minDistance = Math.abs(rect.top);
            closestMonth = month;
          }
        }
      }

      if (closestMonth && closestMonth !== activeMonth) {
        setActiveMonth(closestMonth);
      } else if (!closestMonth && months.length > 0) {
        setActiveMonth(months[0]);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // 初始化执行一次
    setTimeout(handleScroll, 100);

    return () => window.removeEventListener('scroll', handleScroll);
  }, [months, activeMonth, isDragging]);

  // 2. 滚至具体月份
  const scrollToMonth = useCallback((month: string) => {
    if (onScrubRequest) {
      onScrubRequest(month);
    } else {
      // Fallback
      const id = `month-${month.replace('年', '-').replace('月', '')}`;
      const el = document.getElementById(id);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: y, behavior: 'instant' }); 
      }
    }
  }, [onScrubRequest]);

  // 3. 处理拖拽与点击 (Scrubbing)
  const handlePointerEvent = useCallback((e: React.PointerEvent | PointerEvent) => {
    if (!trackRef.current || months.length === 0) return;
    
    // 如果在拖拽，阻止原生行为（虽然 touchAction: none 已起大作用但在个别浏览器仍需要）
    if (e.type === 'pointermove' && isDragging && e.cancelable) {
      e.preventDefault();
    }

    const rect = trackRef.current.getBoundingClientRect();
    // 限制 Y 在 track 范围内
    const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    const percentage = y / rect.height;
    
    // 计算对应的 index
    let index = Math.floor(percentage * months.length);
    if (index >= months.length) index = months.length - 1;
    if (index < 0) index = 0;

    const targetMonth = months[index];

    if (e.type === 'pointermove') {
      setHoverMonth(targetMonth);
      if (isDragging && targetMonth !== activeMonth) {
        setActiveMonth(targetMonth);
        scrollToMonth(targetMonth);
      }
    } else if (e.type === 'pointerdown') {
      setIsDragging(true);
      setActiveMonth(targetMonth);
      setHoverMonth(targetMonth);
      scrollToMonth(targetMonth);
      // 捕获 pointer 以便在外部移动也能拖拽，修复快速脱离范围断触
      if (e.pointerId) {
        trackRef.current.setPointerCapture(e.pointerId);
      }
    } else if (e.type === 'pointerup' || e.type === 'pointercancel') {
      setIsDragging(false);
      if (e.pointerId) {
        trackRef.current.releasePointerCapture(e.pointerId);
      }
    }
  }, [months, isDragging, activeMonth, scrollToMonth]);

  // 全局 touchmove 禁用，以解决移动设备上的拖拽穿透
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (isDragging && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => document.removeEventListener('touchmove', preventDefault);
  }, [isDragging]);


  let lastYear = '';
  if (months.length === 0) return null;

  // 用来确定气泡显示的主体，拖拽或悬停时显示精确月，否则显示当前视野月
  const displayMonth = isHovering || isDragging ? (hoverMonth || activeMonth) : activeMonth;
  
  // 计算气泡和高亮的相对位置
  const displayIndex = months.indexOf(displayMonth);
  // 百分比映射偏移：0 到 100%
  const bubbleTopPercent = months.length > 1 
    ? (displayIndex / (months.length - 1)) * 100 
    : 50;

  return (
    <Box
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoverMonth(''); }}
      sx={{
        position: 'fixed',
        top: '50%',
        right: 0,
        transform: 'translateY(-50%)',
        height: '60vh', // 也可以占满屏：height: '80vh'
        width: 48, // 增加宽度提高点击判定区
        zIndex: 1200,
        display: { xs: 'flex', lg: 'flex' }, // 移动端也支持
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        mr: 1,
        touchAction: 'none', // 关键：禁用浏览器对该区域的触摸平移/缩放处理
      }}
    >
      {/* 悬浮气泡指示器 (动态同步位置) */}
      <Box
        sx={{
          position: 'absolute',
          right: 56,
          // 气泡和圆点垂直居中对齐，顶部和底部加点修正防止越界
          top: `calc(${bubbleTopPercent}%)`, 
          transform: 'translateY(-50%)',
          bgcolor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(8px)',
          color: 'rgba(0, 0, 0, 0.87)',
          px: 1.5,
          py: 0.5,
          borderRadius: 4,
          fontWeight: 800,
          opacity: isHovering || isDragging ? 1 : 0,
          transition: isDragging ? 'none' : 'top 0.1s ease-out, opacity 0.2s',
          pointerEvents: 'none', // 气泡不能挡住点击
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          whiteSpace: 'nowrap',
          zIndex: 1201,
          fontSize: '0.85rem',
        }}
      >
        {displayMonth}
        {/* 小尾巴 */}
        <Box sx={{
          position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%) rotate(45deg)',
          width: 8, height: 8, bgcolor: 'rgba(255, 255, 255, 0.95)'
        }} />
      </Box>

      {/* 沉浸式交互轨道 (Track) */}
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
          '&::before': { // 毛玻璃辅助滑道
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 20,
            borderRadius: 10,
            bgcolor: isHovering || isDragging ? alpha(theme.palette.text.primary, 0.08) : 'transparent',
            backdropFilter: isHovering || isDragging ? 'blur(4px)' : 'none',
            transition: 'all 0.3s',
            zIndex: -1,
          }
        }}
      >
        {
          // eslint-disable-next-line complexity
          months.map((month) => {
          const year = month.substring(0, 4);
          const isYearStart = year !== lastYear;
          lastYear = year;
          
          const isActive = activeMonth === month;
          const isDisplay = displayMonth === month;

          return (
            <Box
              key={month}
              className="month-tick" // 作为参考标识
              sx={{
                width: '100%',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                flex: 1,
                position: 'relative',
                pr: 2,
                pointerEvents: 'none', // 事件全部交给 Track 层处理，防止断触
              }}
            >
              {/* 年份标签: 只在年份变化的第一月显示 */}
              {isYearStart && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    right: 32,
                    fontWeight: 900, // 更粗
                    fontSize: '0.75rem',
                    color: isActive || isDisplay ? 'text.primary' : 'text.secondary',
                    opacity: isHovering || isDragging || isActive || isDisplay ? 1 : (isYearStart ? 0.4 : 0),
                    transition: 'opacity 0.2s, color 0.2s',
                    userSelect: 'none',
                    textShadow: (isHovering || isActive) ? 
                      (theme.palette.mode === 'light' 
                        ? '0px 0px 8px rgba(255,255,255,0.9), 0px 0px 4px rgba(255,255,255,1)' 
                        : '0px 0px 8px rgba(0,0,0,0.9), 0px 0px 4px rgba(0,0,0,1)') 
                      : 'none',
                  }}
                >
                  {year}
                </Typography>
              )}

              {/* 指示点/线 */}
              <Box
                sx={{
                  width: isActive || isDisplay ? 12 : (isYearStart ? 8 : 4),
                  height: isActive || isDisplay ? 12 : 2,
                  borderRadius: isActive || isDisplay ? '50%' : 1,
                  bgcolor: isActive ? 'primary.main' : isDisplay ? 'text.secondary' : 'text.disabled',
                  opacity: isActive || isDisplay ? 1 : 0.3,
                  transition: 'all 0.1s',
                  boxShadow: isActive ? '0 0 8px rgba(33, 150, 243, 0.5)' : 'none',
                }}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default TimelineScrubber;
