import { useEffect, useState, useRef, type SyntheticEvent, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useQueryState } from 'nuqs';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Snackbar,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [zenMode, setZenMode] = useState(false);

  // Swipe Direction tracking for animations
  const [[page, direction], setPage] = useState([currentIndex, 0]);
  useEffect(() => {
    if (currentIndex !== page) {
      setPage([currentIndex, currentIndex > page ? 1 : -1]);
    }
  }, [currentIndex]); // 只依赖 currentIndex，避免 page 变化触发死循环 (不加 page 到依赖数组)

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // 处理滑动变量
  const [touchStart, setTouchStart] = useState<{x: number, y: number} | null>(null);
  const [touchEnd, setTouchEnd] = useState<{x: number, y: number} | null>(null);
  const minSwipeDistance = 50;

  // URL 状态同步 (Deep Linking)
  const [, setSharedId] = useQueryState('id', {
    shallow: true,
    history: 'push' // 关键点：大图模式开启时必须 Push History，从而劫持返回键
  });

  // 挂载和更新时同步 ID 与锁定背景滚动
  useEffect(() => {
    if (wallpaper?.id) {
      setSharedId(wallpaper.id);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [wallpaper?.id, setSharedId]);

  // 关闭对话框并清除 URL ID 的核心方法
  const handleClose = useCallback(async () => {
    await setSharedId(null);
    onClose();
  }, [onClose, setSharedId]);

  // 劫持浏览器的物理返回事件 (PopState)
  useEffect(() => {
    if (!wallpaper) return;

    const handlePopState = (e: PopStateEvent) => {
      // 当用户按下手机的侧滑返回或浏览器的后退键时触发
      // 我们拦截默认行为，直接调用关闭对话框
      e.preventDefault();
      onClose(); // 不调用 handleClose 因为 URL 在 popstate 时已经被浏览器 pop 掉了，再次 setSharedId 会打乱历史
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [wallpaper, onClose]);

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
          handleClose();
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

  // 意念式控件：静止 3 秒后自动隐藏 UI (非 Zen Mode 下有效)
  const showUIState = useRef(showUI);
  useEffect(() => {
    showUIState.current = showUI;
  }, [showUI]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      if (!zenMode) {
        if (!showUIState.current) setShowUI(true);
        clearTimeout(timeout);
        timeout = setTimeout(() => setShowUI(false), 3000);
      }
    };

    // 监听各类交互事件来唤醒 UI
    window.addEventListener('mousemove', resetTimer, { passive: true });
    window.addEventListener('touchstart', resetTimer, { passive: true });
    window.addEventListener('keydown', resetTimer, { passive: true });

    // 初始启动倒计时
    resetTimer();

    return () => {
      clearTimeout(timeout);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [zenMode]); // 彻底移除 currentIndex 依赖，避免每次切图引发不必要的全局解绑与重新绑定

  // 全沉浸“禅模式” (Zero-UI Focus)
  const toggleZenMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    setZenMode(prev => !prev);
    if (!zenMode) {
       setShowUI(false); 
    } else {
       setShowUI(true);
    }
  };

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
        handleClose();
      }
    }
  };

  // 真·无缝下载逻辑
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wallpaper || isDownloading) return;
    
    setIsDownloading(true);
    try {
      const response = await fetch(wallpaper.downloadUrl);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = blobUrl;
      // 提取原始文件名或使用 fallback
      const fileName = wallpaper.downloadUrl.split('/').pop()?.split('?')[0] || `bing-wallpaper-${wallpaper.id}.jpg`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      
      // 清理
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      setToastMessage('下载已完成');
    } catch (err) {
      console.error('Download error:', err);
      // Fallback
      window.open(wallpaper.downloadUrl, '_blank');
      setToastMessage('直接下载失败，已为您打开原图连接');
    } finally {
      setIsDownloading(false);
    }
  };

  // 极简分享与复制逻辑
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!wallpaper) return;

    // 构造带参数的 Deep Link 专属链接
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${wallpaper.id}`;
    const shareTitle = `分享一张必应壁纸: ${wallpaper.title || wallpaper.copyright || wallpaper.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: wallpaper.copyright || undefined,
          url: shareUrl,
        });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share error:', err);
          fallbackCopyTextToClipboard(shareUrl);
        }
      }
    } else {
      fallbackCopyTextToClipboard(shareUrl);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setToastMessage('专属分享链接已复制到剪贴板');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      setToastMessage('复制链接失败');
    });
  };

  // Framer Motion 变体：用于背景的淡入淡出
  const backdropVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  // 极速空间淡入淡出 (Snappy Spatial Crossfade)
  const slideVariants: Variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 40 : -40, // 仅极微小的偏移入场，拒绝拖泥带水
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 40 : -40,
      opacity: 0,
    })
  };

  const uiVariants: Variants = {
    hidden: { opacity: 0, transition: { duration: 0.15 } },
    visible: { opacity: 1, transition: { duration: 0.4 } },
  };

  const textSequenceVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const childItemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { ease: [0.165, 0.84, 0.44, 1] as const, duration: 0.8 }
    }
  };

  return (
    <>
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
            onClick={handleClose}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(5, 5, 5, 0.98)', // 极简纯黑，移除所有高昂的毛玻璃滤镜释放 GPU
              willChange: 'opacity', // HW Acceleration
            }}
          />

          {/* 核心图片：基于 AnimatePresence 的无缝切换与触屏手势层 */}
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            {/* 主图展示区 */}
            <motion.div
              key={`wallpaper-container-${wallpaper.id}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              onDoubleClick={toggleZenMode} // [Zero-UI Focus] 双击进入/退出禅模式
              drag={isMobile ? "y" : false} // [Mobile] 允许 Y 轴拖拽
              dragConstraints={{ top: 0, bottom: 0 }} // 阻尼限制中心点位置
              dragElastic={0.8} // 高阻尼拉伸感
              onDragEnd={(_, info) => {
                // 如果滑动速度快，或者绝对拖拽距离过高，则触发关闭动画 (Physics Drag-to-Dismiss)
                if (Math.abs(info.offset.y) > 150 || Math.abs(info.velocity.y) > 500) {
                  onClose();
                }
              }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] as const }} // 极具进攻性的爽快弹射曲线
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isMobile ? 0 : '4vmin',
                position: 'absolute',
                inset: 0, // 简洁等价于 top/left/right/bottom: 0
                zIndex: 1,
                willChange: 'transform, opacity', // 提示浏览器预创建合成层
              }}
              // 随拖拽位移与变形的动态滤镜效果
              whileDrag={{ scale: 0.9, borderRadius: '32px' }}
              // 绑定触控手势
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* [视觉奇观] 全息环境光泛光池 - 性能极速版 (Hardware Accelerated Ambilight) */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  width: '80vw',
                  height: '80vh',
                  transform: 'translate3d(-50%, -50%, 0)', // Force GPU layer
                  // 使用极其平滑的渐变色圈代替真实的模糊计算，降低10倍GPU渲染压力
                  background: `radial-gradient(ellipse at center, rgba(${parseInt(wallpaper.dominantColor.slice(0, 2), 16)}, ${parseInt(wallpaper.dominantColor.slice(2, 4), 16)}, ${parseInt(wallpaper.dominantColor.slice(4, 6), 16)}, 0.4) 0%, transparent 60%)`,
                  opacity: imageLoaded ? 1 : 0, 
                  transition: 'opacity 1s ease-in-out',
                  pointerEvents: 'none',
                  zIndex: 0,
                  willChange: 'opacity', // 告诉浏览器仅这一层会变
                }}
              />
              <Box
                sx={{
                  position: 'relative',
                  width: 'fit-content',
                  height: 'fit-content',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  backgroundColor: `#${wallpaper.dominantColor}`,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)', 
                  overflow: 'hidden',
                  zIndex: 1, // 抬高层级以盖住光晕
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
                  src={wallpaper.imageUrl}
                  alt={wallpaper.title || wallpaper.copyright || 'Bing Wallpaper'}
                  onLoad={() => setImageLoaded(true)}
                  decoding="async"
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
            {/* 关闭按钮 (Gallery Minimalist Close) */}
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.9 }}
              style={{
                position: 'absolute',
                top: 32,
                right: 32,
                zIndex: 1301,
                pointerEvents: 'auto',
              }}
            >
              <IconButton
                onClick={onClose}
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: 'rgba(0, 0, 0, 0.2)', // 微微偏暗的毛玻璃，适应任何亮度的背景图
                  color: 'rgba(255, 255, 255, 0.8)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  transition: 'all 0.3s ease',
                  '&:hover': { 
                    bgcolor: 'rgba(255, 255, 255, 0.15)',
                    color: 'white',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </motion.div>

            {/* 桌面端高定画廊级左右翻页控件 (Gallery Navigators) */}
            {!isMobile && currentIndex > 0 && (
              <motion.div 
                whileHover={{ scale: 1.1, x: -4 }} 
                whileTap={{ scale: 0.9 }}
                style={{
                  position: 'absolute',
                  top: '50%', 
                  left: 48,
                  marginTop: -28, // height is 56, offset to true center
                  zIndex: 1301,
                  pointerEvents: 'auto',
                }}
              >
                <IconButton
                  onClick={(e) => { e.stopPropagation(); onPrevious(); }}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    '&:hover': { 
                      bgcolor: 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 0 30px rgba(255,255,255,0.15)'
                    },
                  }}
                >
                  <KeyboardArrowLeftIcon fontSize="large" sx={{ ml: -0.5 }} />
                </IconButton>
              </motion.div>
            )}

            {!isMobile && currentIndex < allWallpapers.length - 1 && (
              <motion.div 
                whileHover={{ scale: 1.1, x: 4 }} 
                whileTap={{ scale: 0.9 }}
                style={{
                  position: 'absolute',
                  top: '50%', 
                  right: 48,
                  marginTop: -28,
                  zIndex: 1301,
                  pointerEvents: 'auto',
                }}
              >
                <IconButton
                  onClick={(e) => { e.stopPropagation(); onNext(); }}
                  sx={{
                    width: 56,
                    height: 56,
                    bgcolor: 'rgba(255, 255, 255, 0.05)',
                    color: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    '&:hover': { 
                      bgcolor: 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.4)',
                      boxShadow: '0 0 30px rgba(255,255,255,0.15)'
                    },
                  }}
                >
                  <KeyboardArrowRightIcon fontSize="large" />
                </IconButton>
              </motion.div>
            )}


            {/* 底部信息栏 */}
            {/* [Gallery Typography] 极简艺术展签栏 */}
            <Box
              sx={{
                position: 'absolute',
                bottom: { xs: 32, md: 48 },
                left: { xs: 24, md: 48 },
                right: { xs: 24, md: 48 },
                pointerEvents: 'none', // 让内层元素的 auto 生效，外层不挡底部点击
              }}
            >
              <motion.div
                key={`info-${wallpaper.id}`}
                variants={textSequenceVariants}
                initial="hidden"
                animate="visible"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  width: '100%',
                }}
              >
                {/* 左侧：画作元数据 (The Art) */}
                <div style={{ color: 'white', maxWidth: '70%', pointerEvents: 'auto' }}>
                  <motion.div variants={childItemVariants}>
                    <Typography 
                      variant="h5" 
                      sx={{ 
                        fontFamily: '"Times New Roman", Times, serif', // 衬线体复古人文感
                        fontWeight: 400, 
                        letterSpacing: '0.02em',
                        lineHeight: 1.2,
                        mb: 1.5, 
                        textShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {wallpaper.copyright || '无版权信息'}
                    </Typography>
                  </motion.div>
                  
                  <motion.div 
                    variants={childItemVariants}
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'rgba(255, 255, 255, 0.7)',
                        textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      }}
                    >
                      {wallpaper.title}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        fontFamily: 'Inter, system-ui, sans-serif',
                        fontWeight: 300,
                        letterSpacing: '0.05em',
                        color: 'rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      {(() => {
                        // 将 2026-02-23 转为 FEB 23, 2026
                        if (!wallpaper.date) return '';
                        try {
                          const d = new Date(String(wallpaper.date).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'));
                          return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase();
                        } catch (e) {
                          return wallpaper.date;
                        }
                      })()}
                    </Typography>
                  </motion.div>
                </div>

                {/* 右侧：徕卡级交互圆柱钮 (The Tools) */}
                <motion.div variants={childItemVariants} style={{ display: 'flex', gap: 16, pointerEvents: 'auto' }}>
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
                    <IconButton
                      onClick={handleShare}
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.3s ease',
                        '&:hover': { 
                          bgcolor: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.8)',
                          boxShadow: '0 0 20px rgba(255,255,255,0.2)'
                        },
                      }}
                    >
                      <ShareIcon fontSize="small" />
                    </IconButton>
                  </motion.div>

                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}>
                    <IconButton
                      onClick={handleDownload}
                      disabled={isDownloading}
                      sx={{
                        width: 48,
                        height: 48,
                        bgcolor: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.3s ease',
                        '&:hover': { 
                          bgcolor: 'rgba(255, 255, 255, 0.25)',
                          border: '1px solid rgba(255, 255, 255, 0.8)',
                          boxShadow: '0 0 20px rgba(255,255,255,0.2)'
                        },
                        '&.Mui-disabled': {
                          bgcolor: 'rgba(255, 255, 255, 0.05)',
                          color: 'rgba(255, 255, 255, 0.3)',
                        }
                      }}
                    >
                      {isDownloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon fontSize="small" />}
                    </IconButton>
                  </motion.div>
                </motion.div>
              </motion.div>
            </Box>
          </motion.div>
        </Box>
      )}
    </AnimatePresence>

    {/* Toast 通知层，脱离 AnimatePresence 保持可见 */}
    <Snackbar
      open={!!toastMessage}
      autoHideDuration={3000}
      onClose={() => setToastMessage(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 9999 }}
    >
      <Alert onClose={() => setToastMessage(null)} severity="success" sx={{ width: '100%', borderRadius: '100px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        {toastMessage}
      </Alert>
    </Snackbar>
    </>
  );
};

export default ImageDialog;
