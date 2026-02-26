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
  const [showUI, setShowUI] = useState(true);
  
  // 处理滑动变量
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

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
        case 'ArrowUp':
          if (currentIndex > 0) onPrevious();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          if (currentIndex < allWallpapers.length - 1) onNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [wallpaper, currentIndex, allWallpapers.length, onClose, onPrevious, onNext]);

  // 意念式控件：静止 3 秒后自动隐藏 UI
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    const resetTimer = () => {
      setShowUI(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => setShowUI(false), 3000);
    };

    // 监听各类交互事件来唤醒 UI
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    window.addEventListener('keydown', resetTimer);

    // 初始启动倒计时
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, []);

  // 手势处理 (Touch Swipe)
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY });
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distanceX = touchStart.x - touchEnd.x;
    const distanceY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(distanceX) > Math.abs(distanceY);

    if (isHorizontalSwipe && Math.abs(distanceX) > minSwipeDistance) {
      if (distanceX > 0) {
        // Swipe Left: Next Image
        if (currentIndex < allWallpapers.length - 1) onNext();
      } else {
        // Swipe Right: Prev Image
        if (currentIndex > 0) onPrevious();
      }
    } else if (!isHorizontalSwipe && Math.abs(distanceY) > minSwipeDistance) {
      if (distanceY < 0) {
        // Swipe Down: Close Dialog
        onClose();
      }
    }
  };

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
          {/* 半透明纯黑电影级沉浸背景层 */}
          <motion.div
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.95)', // 极度深邃的黑
              backdropFilter: 'blur(20px) brightness(60%)', // 显著降低高昂的毛玻璃开销以解决卡顿
              WebkitBackdropFilter: 'blur(20px) brightness(60%)',
              cursor: 'zoom-out',
            }}
          />

          {/* 核心图片：基于 AnimatePresence 的无缝切换与触屏手势层 */}
          <AnimatePresence>
            <motion.div
              key={`wallpaper-container-${wallpaper.id}`}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100vw', // 满屏宽容度
                height: '100vh',
                zIndex: 1301,
              }}
              // 绑定触控手势
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: 'fit-content',
                  height: 'fit-content',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  backgroundColor: `#${wallpaper.dominantColor}`,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)', // 降低渲染消耗
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
                  src={wallpaper.downloadUrl}
                  alt={wallpaper.title || wallpaper.copyright || 'Bing Wallpaper'}
                  onLoad={() => setImageLoaded(true)}
                  style={{
                    maxWidth: '100vw', // 解除边距限制，图片可以直接顶满屏幕
                    maxHeight: '100vh',
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
            animate={showUI ? "visible" : "hidden"} // 受控于超时隐藏状态
            exit="hidden"
            transition={{ duration: 0.5, ease: [0.165, 0.84, 0.44, 1] }} 
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
              <Box key={wallpaper.id} sx={{ color: 'white', maxWidth: '70%' }}>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 600, 
                    mb: 1, 
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    // Typewriter Effect (No cursor)
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    width: '0',
                    animation: 'typing 1s cubic-bezier(0.165, 0.84, 0.44, 1) forwards',
                    animationDelay: '0.4s', // 图片出现后再开始打字
                    '@keyframes typing': {
                      from: { width: '0' },
                      to: { width: '100%' }
                    }
                  }}
                >
                  {wallpaper.copyright || '无版权信息'}
                </Typography>
                <Typography 
                  variant="body2" 
                  sx={{ 
                    opacity: 0, // 初始隐藏
                    display: 'flex', 
                    gap: 2,
                    animation: 'fadeInUp 0.6s ease forwards',
                    animationDelay: '1.0s', // 稍微提早一点淡入
                    '@keyframes fadeInUp': {
                      from: { opacity: 0, transform: 'translateY(10px)' },
                      to: { opacity: 0.8, transform: 'translateY(0)' }
                    }
                  }}
                >
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
