import * as React from 'react';
import { useState } from 'react';
import { motion } from 'framer-motion';
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
  activeSharedId?: string | null;
}

const WallpaperCard = ({
  wallpaper,
  onImageClick,
  isFavorite = false,
  onToggleFavorite,
  activeSharedId = null,
}: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // 提取格式化日期
  const dateDisplay = wallpaper.dateFmt || `${String(wallpaper.date).substring(0, 4)}/${String(wallpaper.date).substring(4, 6)}/${String(wallpaper.date).substring(6, 8)}`;

  return (
    <Box
      component={motion.div}
      whileHover="hover"
      sx={{
        position: 'relative',
        width: '100%',
        aspectRatio: '16/9', // 保持标准的壁纸比例
        borderRadius: 2, // 对应 Theme 中的 shape.borderRadius: 16px
        overflow: 'hidden',
        cursor: 'pointer',
        backgroundColor: `#${wallpaper.dominantColor}`, // 加载前的骨架背景色
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
        // 悬浮显示遮罩和附加操作
        '&:hover': {
          '& .overlay-content': {
            opacity: 1, // 唤出遮罩和文字
          }
        },
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={() => onImageClick(wallpaper)}
    >
      {/* 核心图片 - 只有当全屏未打开(null) 或是当前正在打开的图片时，才赋予 layoutId，防止浏览幻灯片时飞回网格 */}
      <motion.img
        layoutId={activeSharedId === null || activeSharedId === wallpaper.id ? `wallpaper-${wallpaper.id}` : undefined}
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
          hover: { scale: 1.04 }
        }}
        transition={{
          scale: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: imageLoaded ? 1 : 0,
          transition: 'opacity 0.3s ease-in',
          display: 'block',
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
  );
};

export default WallpaperCard;
