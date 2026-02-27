import * as React from 'react';
import { useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import type { WallpaperData } from '../types';

interface Props {
  wallpaper: WallpaperData;
  onImageClick: (wallpaper: WallpaperData) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (wallpaper: WallpaperData) => void;
}

const WallpaperCard = ({
  wallpaper,
  onImageClick,
  isFavorite = false,
  onToggleFavorite,
}: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  // === Framer Motion 3D 悬浮物理系统 ===
  // 鼠标相对卡片中心的坐标 (-1 到 1)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  // 阻尼弹簧配置，使倾斜和光斑移动更具物理实感
  const springConfig = { damping: 20, stiffness: 150, mass: 0.5 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // 映射到旋转角度 (最大偏转 8 度)
  const rotateX = useTransform(smoothMouseY, [-1, 1], [8, -8]);
  const rotateY = useTransform(smoothMouseX, [-1, 1], [-8, 8]);
  
  // 映射到高光位置 (0% 到 100%)
  const glareX = useTransform(smoothMouseX, [-1, 1], [100, 0]);
  const glareY = useTransform(smoothMouseY, [-1, 1], [100, 0]);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 60%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    // 计算相对中心的归一化偏移 (-1 到 1)
    const normalizedX = (e.clientX - rect.left - centerX) / centerX;
    const normalizedY = (e.clientY - rect.top - centerY) / centerY;
    
    mouseX.set(normalizedX);
    mouseY.set(normalizedY);
  };

  const handleMouseLeave = () => {
    // 鼠标离开时弹簧回正
    mouseX.set(0);
    mouseY.set(0);
  };

  // 提取格式化日期
  const dateDisplay = wallpaper.dateFmt || `${String(wallpaper.date).substring(0, 4)}/${String(wallpaper.date).substring(4, 6)}/${String(wallpaper.date).substring(6, 8)}`;

  return (
    <Box
      sx={{ 
         // 这层作为透视容器 (Perspective Container)
         perspective: 1200, 
         position: 'relative',
         width: '100%',
         zIndex: 1, // 基础层级
         '&:hover': {
           zIndex: 10, // 悬停时提升整组 Z-index，确保溢出的背光能盖住相邻元素
         }
      }}
    >
      {/* C. 环境光溢出 (Ambient Glow) - 悬置在卡片背后的主色辉光 */}
      <Box
        component={motion.div}
        style={{
          scale: useTransform(smoothMouseX, (v) => v !== 0 ? 1.05 : 1), // 仅在互动时轻微放大
          opacity: useTransform(smoothMouseX, (v) => v !== 0 ? 0.6 : 0), // 互动时才会点亮环境光
        }}
        sx={{
          position: 'absolute',
          top: '5%',
          left: '5%',
          right: '5%',
          bottom: '5%',
          background: `#${wallpaper.dominantColor}`,
          filter: 'blur(30px) saturate(200%)', // 极强的模糊溢出和发色增强
          zIndex: -1, // 在物理卡片之下
          transition: 'opacity 0.5s ease', // 基础过渡保护
          borderRadius: '12px',
        }}
      />

      {/* 物理实体卡片 */}
      <Box
        component={motion.div}
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        whileHover="hover"
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9', // 保持标准的壁纸比例
          borderRadius: 0, // 彻底消除边界圆角，Edge-to-Edge 沉浸感
          overflow: 'hidden',
          cursor: 'pointer',
          backgroundColor: `#${wallpaper.dominantColor}`, // 加载前的骨架背景色
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)', // 增加默认景深阴影
        '&::before': {
          // 骨架屏加载动画 (Pulse)
          content: '""',
          display: imageLoaded ? 'none' : 'block',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%)',
          animation: 'shimmer 1.5s infinite',
          zIndex: 1,
        },
        '@keyframes shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        // 悬浮微交互：取消所有外层遮罩限制，单纯依赖内部元素的呈现
        '&:hover': {
          zIndex: 10, // 悬停时提升层级
          '& .overlay-content': {
            opacity: 1, // 唤出遮罩和文字
          }
        },
        transition: 'all 0.6s cubic-bezier(0.165, 0.84, 0.44, 1)', // 更舒缓的弹簧过渡
      }}
      onClick={() => onImageClick(wallpaper)}
      >
        {/* 核心图片 - 赋予微弱的放大呼吸效果 */}
        <motion.img
          layoutId={`wallpaper-image-${wallpaper.id}`} // 与大图模式的关联点，触发跨组件 Hero Transition
          className="wallpaper-img"
          src={wallpaper.imageUrl}
          alt={wallpaper.title || wallpaper.copyright || 'Bing Wallpaper'}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
            const target = e.target as HTMLImageElement;
            target.src = `https://via.placeholder.com/600x400/${wallpaper.dominantColor}/ffffff?text=Bing+Wallpaper`;
            setImageLoaded(true);
          }}
          variants={{
            hover: { scale: 1.08 } // 呼吸式放大更激进一些，配接 3D 更有张力
          }}
          transition={{
            scale: { duration: 0.8, ease: [0.165, 0.84, 0.44, 1] } // 超级顺滑的阻尼
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease-in',
            display: 'block',
            transform: 'translateZ(10px)', // 在 3D 空间中轻微抬高本图深度
          }}
        />

        {/* 物理反馈：游走高光 (Specular Glare) */}
        <Box 
          component={motion.div}
          style={{ background: glareBackground }}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 3, // 必须盖在图片之上
            pointerEvents: 'none',
            mixBlendMode: 'overlay', // 以强光混合模式提亮下方图片
          }}
        />

        {/* 悬浮遮罩内容 (Hover Overlay) */}
      <Box
        className="overlay-content"
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0, // 默认隐藏
          transition: 'opacity 0.3s ease-in-out',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.6) 80%, rgba(0,0,0,0.85) 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          p: 2,
          zIndex: 2,
        }}
      >
        {/* 顶部：右上角操作区 */}
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

          {onToggleFavorite && (
            <Tooltip title={isFavorite ? "取消收藏" : "添加收藏"} placement="left">
              <IconButton
                size="small"
                sx={{
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(8px)',
                  color: isFavorite ? '#ef4444' : 'white', // tailwind red-500
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.2)'
                  },
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(wallpaper);
                }}
              >
                {isFavorite ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* 底部：文本信息区 */}
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
};

export default WallpaperCard;
