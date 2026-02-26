import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

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

      if (closestMonth) {
        setActiveMonth(prev => prev !== closestMonth ? closestMonth : prev);
      } else if (months.length > 0) {
        setActiveMonth(prev => prev !== months[0] ? months[0] : prev);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // 初始化执行一次
    const timer = setTimeout(handleScroll, 100);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [months, isDragging]);

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
  }, [months, isDragging, activeMonth, scrollToMonth]);

  // 全局 touchmove 禁用，以解决移动设备上的拖拽穿透
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      if (isDragging && e.cancelable) e.preventDefault();
    };
    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => document.removeEventListener('touchmove', preventDefault);
  }, [isDragging]);


  if (months.length === 0) return null;

  // 用来确定气泡显示的主体，拖拽或悬停时显示精确月，否则显示当前视野月
  const displayMonth = isHovering || isDragging ? (hoverMonth || activeMonth) : activeMonth;
  
  // 计算气泡和高亮的相对位置
  const displayIndex = months.indexOf(displayMonth);
  // 百分比映射偏移：0 到 100% 对齐中心点
  const bubbleTopPercent = months.length > 0 
    ? ((displayIndex + 0.5) / months.length) * 100 
    : 50;

  // 这里我们不再强依赖一个物理 top 坐标的白色气泡背景框
  // 而是采用绝对定位跟随的悬空文本，并且使用 spring transition

  return (
    <Box
      ref={containerRef}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => { setIsHovering(false); setHoverMonth(''); }}
      sx={{
        position: 'fixed',
        top: '50%',
        right: { xs: 8, md: 16 }, // 边缘留白
        transform: 'translateY(-50%)',
        height: '70vh', 
        width: 64, // 加宽触摸/鼠标悬停感应区
        zIndex: 1200,
        display: { xs: 'flex', lg: 'flex' }, // 移动端也支持，更窄
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        touchAction: 'none', // 禁用平移缩放拦截
      }}
    >
      {/* 极简流体吸附文字 (Hovering Text)  */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          right: { xs: 32, md: 48 }, // 与光点拉开距离
          top: `calc(${bubbleTopPercent}%)`, 
          transform: 'translateY(-50%)',
          color: theme.palette.mode === 'dark' ? '#fff' : '#000',
          fontWeight: 800, // 极粗
          opacity: isHovering || isDragging ? 0.9 : 0, // 仅交互时可见
          transition: isDragging 
            ? 'none' // 拖拽时完全零延迟跟手
            : 'top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.2s', // 弹簧动效
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 1201,
          fontSize: { xs: '1rem', md: '1.25rem' }, // 更大的展示字体
          letterSpacing: '-0.02em',
          textShadow: theme.palette.mode === 'dark' 
            ? '0 4px 24px rgba(255,255,255,0.4), 0 1px 3px rgba(0,0,0,1)'
            : '0 4px 24px rgba(0,0,0,0.2), 0 1px 3px rgba(255,255,255,1)',
        }}
      >
        {displayMonth}
      </Typography>


      {/* 沉浸式交互轨道 (Track) - 移除毛玻璃辅助跑道，只保留感应区 */}
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
          // eslint-disable-next-line complexity
          months.map((month, index) => {
          const year = month.substring(0, 4);
          const isYearStart = index === 0 || year !== months[index - 1].substring(0, 4);
          
          const isActive = activeMonth === month;
          const isDisplay = displayMonth === month;
          
          // 计算距离手指的相对距离，用于动态放大圆点 (模拟磁吸与呼吸涟漪)
          let distanceScale = 1;
          let distanceOpacity = 0.15; // 基础超低透明度
          const diff = Math.abs(index - displayIndex);
          
          if (isHovering || isDragging) {
            if (diff === 0) {
              distanceScale = 3.5; // 当前悬停项最大
              distanceOpacity = 1;
            } else if (diff === 1) {
              distanceScale = 2; // 旁边项稍大
              distanceOpacity = 0.6;
            } else if (diff === 2) {
              distanceScale = 1.2;
              distanceOpacity = 0.3;
            }
          } else {
            // 平时态，只有当前活动月亮起
            if (isActive) {
              distanceScale = 2;
              distanceOpacity = 0.8;
            }
          }

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
                pr: 1, // 离屏幕右缘近一点
                pointerEvents: 'none', // 事件全部交给 Track 层处理
              }}
            >
              {/* 年份标签: 极简流体 */}
              {isYearStart && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    right: 16,
                    fontWeight: 800, 
                    fontSize: '0.65rem',
                    color: theme.palette.text.primary,
                    opacity: isHovering || isDragging || isActive || isDisplay ? 0 : (isYearStart ? 0.3 : 0),
                    transition: 'opacity 0.4s ease',
                    userSelect: 'none',
                    letterSpacing: '0.05em',
                  }}
                >
                  {year}
                </Typography>
              )}

              {/* 呼吸星点 (Breathing Dots) */}
              <Box
                sx={{
                  width: 2, 
                  height: 2, 
                  borderRadius: '50%',
                  bgcolor: theme.palette.text.primary,
                  opacity: distanceOpacity,
                  transform: `scale(${distanceScale})`,
                  transition: isDragging ? 'transform 0.1s, opacity 0.1s' : 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  transformOrigin: 'right center', // 向左膨胀
                  boxShadow: diff === 0 && (isHovering || isDragging) 
                    ? `0 0 12px 2px ${theme.palette.text.primary}` 
                    : 'none', // 高亮时的辉光
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
