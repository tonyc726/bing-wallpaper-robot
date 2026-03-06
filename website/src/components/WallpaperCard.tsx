import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import type { WallpaperData } from '../types';

interface Props {
  wallpaper: WallpaperData;
  onImageClick: (wallpaper: WallpaperData) => void;
}

// 性能优化：使用 memo 避免不必要的重渲染
const WallpaperCard = React.memo(({
  wallpaper,
  onImageClick,
}: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 使用 IntersectionObserver 精确控制图片加载：只在可视区域内才加载
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsInView(true);
          observer.disconnect(); // 只触发一次
        }
      },
      { rootMargin: '200px', threshold: 0 }
    );

    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  // === 纯 CSS 3D 悬浮效果 ===
  // 通过 CSS 自定义属性 (Custom Properties) 驱动 3D 变换
  // 彻底消除每张卡片 8 个 Framer Motion 运行时订阅
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const normalizedX = (e.clientX - rect.left - centerX) / centerX;
    const normalizedY = (e.clientY - rect.top - centerY) / centerY;

    // 直接写入 CSS 变量，跳过 React 重渲染
    card.style.setProperty('--rotateX', `${-normalizedY * 8}deg`);
    card.style.setProperty('--rotateY', `${normalizedX * 8}deg`);
    card.style.setProperty('--glareX', `${((normalizedX + 1) / 2) * 100}%`);
    card.style.setProperty('--glareY', `${((normalizedY + 1) / 2) * 100}%`);
    card.style.setProperty('--glareOpacity', '1');
  }, []);

  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--rotateX', '0deg');
    card.style.setProperty('--rotateY', '0deg');
    card.style.setProperty('--glareOpacity', '0');
  }, []);

  const dateDisplay = wallpaper.dateFmt || `${String(wallpaper.date).substring(0, 4)}/${String(wallpaper.date).substring(4, 6)}/${String(wallpaper.date).substring(6, 8)}`;

  return (
    <Box
      sx={{
        perspective: 1200,
        position: 'relative',
        width: '100%',
        zIndex: 1,
        '&:hover': { zIndex: 10 },
      }}
    >
      {/* 环境光溢出 (Ambient Glow) - 纯 CSS 控制，无 JS 动画 */}
      <Box
        sx={{
          position: 'absolute',
          top: '5%',
          left: '5%',
          right: '5%',
          bottom: '5%',
          background: `#${wallpaper.dominantColor}`,
          filter: 'blur(30px) saturate(200%)',
          zIndex: -1,
          opacity: 0,
          transition: 'opacity 0.5s ease',
          borderRadius: '12px',
          // 父容器 hover 时点亮，纯 CSS 无 JS
          '.wallpaper-outer:hover &': { opacity: 0.6 },
        }}
      />

      {/* 物理实体卡片 - CSS 3D Transform */}
      <Box
        ref={cardRef}
        className="wallpaper-outer"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          borderRadius: 0,
          overflow: 'hidden',
          cursor: 'pointer',
          backgroundColor: `#${wallpaper.dominantColor}`,
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          // CSS 3D：由 CSS 变量驱动，默认回正值
          '--rotateX': '0deg',
          '--rotateY': '0deg',
          '--glareX': '50%',
          '--glareY': '50%',
          '--glareOpacity': '0',
          transform: 'rotateX(var(--rotateX)) rotateY(var(--rotateY))',
          // 使用 cubic-bezier spring 近似，性能远好于 JS spring
          transition: 'transform 0.35s cubic-bezier(0.03, 0.98, 0.52, 0.99), box-shadow 0.35s ease',
          transformStyle: 'preserve-3d',
          '&::before': {
            // 骨架屏加载动画
            content: '""',
            display: imageLoaded ? 'none' : 'block',
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
            animation: 'shimmer 1.5s infinite',
            zIndex: 1,
          },
          '@keyframes shimmer': {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(100%)' },
          },
          '&:hover': {
            zIndex: 10,
            '& .overlay-content': { opacity: 1 },
            '& .wallpaper-img': { transform: 'translateZ(10px) scale(1.08)' },
          },
        }}
        onClick={() => onImageClick(wallpaper)}
      >
        {/* 核心图片 - CSS Transform 实现 scale hover */}
        <img
          ref={imgRef}
          className="wallpaper-img"
          src={isInView ? wallpaper.imageUrl : undefined}
          alt={wallpaper.title || wallpaper.copyright || '拾影阁馆藏'}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            (e.target as HTMLImageElement).style.display = 'none';
            setImageLoaded(true);
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in, transform 0.8s cubic-bezier(0.165, 0.84, 0.44, 1)',
            display: 'block',
            transform: 'translateZ(10px) scale(1)',
          }}
        />

        {/* 游走高光 (Specular Glare) - 由 CSS 变量驱动，无 JS 订阅 */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            mixBlendMode: 'overlay',
            opacity: 'var(--glareOpacity)',
            background: 'radial-gradient(circle at var(--glareX) var(--glareY), rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 60%)',
            transition: 'opacity 0.3s ease',
          }}
        />

        {/* 悬浮遮罩内容 */}
        <Box
          className="overlay-content"
          sx={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            opacity: 0,
            transition: 'opacity 0.3s ease-in-out',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.85) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            p: 2,
            zIndex: 2,
          }}
        >
          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Tooltip title="下载原图" placement="left">
              <IconButton
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  color: 'white',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(wallpaper.downloadUrl, '_blank');
                }}
              >
                <DownloadIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255,255,255,0.7)',
                fontWeight: 500,
                letterSpacing: '0.05em',
                mb: 0.5,
                display: 'block',
              }}
            >
              {dateDisplay}
            </Typography>

            {wallpaper.title && (
              <Typography
                variant="subtitle1"
                sx={{
                  color: 'white',
                  fontWeight: 600,
                  lineHeight: 1.2,
                  mb: 0.5,
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {wallpaper.title}
              </Typography>
            )}

            <Typography
              variant="body2"
              sx={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.8rem',
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {wallpaper.copyright || '无版权信息'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}, (prevProps: Props, nextProps: Props) => {
  if (prevProps.wallpaper.id !== nextProps.wallpaper.id) return false;
  if (prevProps.wallpaper.date !== nextProps.wallpaper.date) return false;
  if (prevProps.wallpaper.title !== nextProps.wallpaper.title) return false;
  return true;
});

export default WallpaperCard;
