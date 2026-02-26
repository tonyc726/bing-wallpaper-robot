import { useEffect, useState, type SyntheticEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Box,
  Typography,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import type { WallpaperData } from '../types';

interface Props {
  wallpaper: WallpaperData | null;
  allWallpapers: WallpaperData[];
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}

const ImageDialog = ({
  wallpaper,
  allWallpapers,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
}: Props) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  // 当切换图片时重置加载状态
  useEffect(() => {
    setImageLoaded(false);
  }, [wallpaper?.id]);

  // 键盘导航
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!wallpaper) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (currentIndex > 0) onPrevious();
          break;
        case 'ArrowRight':
          if (currentIndex < allWallpapers.length - 1) onNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wallpaper, currentIndex, allWallpapers.length, onClose, onPrevious, onNext]);

  // Framer Motion 变体：用于背景的淡入淡出
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const uiVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { delay: 0.3 } }, // 图片落位后再显示 UI
  };

  return (
    <AnimatePresence>
      {wallpaper && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1300, // MUI Dialog default is 1300
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* 半透明黑色背景层 */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              cursor: 'zoom-out',
            }}
          />

          {/* 核心图片：基于 AnimatePresence 的无缝切换与共享元素动画 */}
          <AnimatePresence mode="popLayout">
            <motion.div
              key={`wallpaper-container-${wallpaper.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
              style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                maxWidth: '90vw',
                maxHeight: '90vh',
                zIndex: 1301,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: 'fit-content',
                  height: 'fit-content',
                  backgroundColor: `#${wallpaper.dominantColor}`,
                  borderRadius: '8px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  // Skeleton Shimmer effect
                  '&::before': {
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
                    '100%': { transform: 'translateX(100%)' }
                  }
                }}
              >
                <motion.img
                  layoutId={`wallpaper-${wallpaper.id}`} // Keep shared element ID only on the img itself
                  src={wallpaper.downloadUrl}
                  alt={wallpaper.title || wallpaper.copyright || 'Bing Wallpaper'}
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    maxWidth: '90vw',
                    maxHeight: '90vh',
                    objectFit: 'contain',
                    display: 'block',
                    opacity: imageLoaded ? 1 : 0, // 隐藏直到加载完成（骨架屏透出）
                  }}
                  onError={(e: SyntheticEvent<HTMLImageElement, Event>) => {
                    const target = e.target as HTMLImageElement;
                    target.src = `https://via.placeholder.com/1200x800/${wallpaper.dominantColor}/ffffff?text=${encodeURIComponent(wallpaper.copyright || 'Bing Wallpaper')}`;
                    setImageLoaded(true);
                  }}
                />
              </Box>
            </motion.div>
          </AnimatePresence>

          {/* 上层 UI 控制区 */}
          <motion.div
            variants={uiVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none', // 确保不去挡住背景的点击关闭
              zIndex: 1302,
            }}
          >
            {/* 关闭按钮 */}
            <IconButton
              onClick={onClose}
              sx={{
                position: 'absolute',
                top: 24,
                right: 24,
                bgcolor: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                pointerEvents: 'auto',
                backdropFilter: 'blur(10px)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
              }}
            >
              <CloseIcon />
            </IconButton>

            {/* 上一张按钮 */}
            {currentIndex > 0 && (
              <IconButton
                onClick={(e) => { e.stopPropagation(); onPrevious(); }}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: 24,
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  pointerEvents: 'auto',
                  backdropFilter: 'blur(10px)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                }}
              >
                <ArrowBackIcon fontSize="large" />
              </IconButton>
            )}

            {/* 下一张按钮 */}
            {currentIndex < allWallpapers.length - 1 && (
              <IconButton
                onClick={(e) => { e.stopPropagation(); onNext(); }}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  right: 24,
                  transform: 'translateY(-50%)',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  pointerEvents: 'auto',
                  backdropFilter: 'blur(10px)',
                  '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.2)' },
                }}
              >
                <ArrowForwardIcon fontSize="large" />
              </IconButton>
            )}

            {/* 底部信息栏 */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                p: { xs: 3, md: 4 },
                background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                pointerEvents: 'auto',
              }}
            >
              <Box sx={{ color: 'white', maxWidth: '70%' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  {wallpaper.copyright || '无版权信息'}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8, display: 'flex', gap: 2 }}>
                  <span>📅 {wallpaper.dateFmt || wallpaper.date}</span>
                  {wallpaper.title && <span>📝 {wallpaper.title}</span>}
                  <span>🖼️ {currentIndex + 1} / {allWallpapers.length}</span>
                </Typography>
              </Box>

              <IconButton
                onClick={(e) => { e.stopPropagation(); window.open(wallpaper.downloadUrl, '_blank'); }}
                sx={{
                  bgcolor: 'primary.main',
                  color: '#666',
                  px: 3,
                  py: 1.5,
                  borderRadius: '100px',
                  '&:hover': { bgcolor: 'primary.dark' },
                  display: 'flex',
                  gap: 1,
                }}
              >
                <DownloadIcon />
                <Typography variant="button" sx={{ fontWeight: 600, color: '#666' }}>下载原图</Typography>
              </IconButton>
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>
  );
};

export default ImageDialog;
