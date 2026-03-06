/**
 * PWA 安装提示组件
 * 引导用户安装应用
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

const PWAInstallPrompt: React.FC = () => {
  const theme = useTheme();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 检查是否已安装
    const checkInstalled = () => {
      // 检查是否在独立模式下运行
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      // 检查 iOS Safari 的添加到主屏幕
      const isInWebAppiOS = window.navigator.standalone === true;
      // 检查 Chrome 的安装状态
      const isInstalledChrome = window.matchMedia('(display-mode: window-controls-overlay)').matches;

      if (isStandalone || isInWebAppiOS || isInstalledChrome) {
        setIsInstalled(true);
      }
    };

    checkInstalled();

    // 监听 beforeinstallprompt 事件
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;

      // 如果用户还没有安装应用，显示安装提示
      if (!isInstalled) {
        setDeferredPrompt(event);
        // 延迟显示，给用户一些时间了解应用
        setTimeout(() => {
          setShowInstallPrompt(true);
        }, 5000);
      }
    };

    // 监听应用安装完成
    const handleAppInstalled = () => {
      console.log('[PWA] 应用已安装');
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    console.log('[PWA] 显示安装提示');

    // 显示安装提示
    await deferredPrompt.prompt();

    // 等待用户响应
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      console.log('[PWA] 用户接受了安装提示');
    } else {
      console.log('[PWA] 用户拒绝了安装提示');
    }

    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);

    // 如果用户Dismissed，记录时间，24小时后再显示
    const dismissTime = Date.now();
    localStorage.setItem('pwa-install-dismissed', dismissTime.toString());
  };

  // 检查是否应该显示（24小时冷却期）
  useEffect(() => {
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const timeSinceDismiss = Date.now() - parseInt(dismissedTime, 10);
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (timeSinceDismiss < twentyFourHours) {
        setShowInstallPrompt(false);
      }
    }
  }, []);

  // 如果已安装或不满足显示条件，不渲染
  if (isInstalled || !showInstallPrompt || !deferredPrompt) {
    return null;
  }

  // Cinematic Capsule Design
  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: { xs: 24, md: 40 },
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        pointerEvents: 'none', // 背景不阻挡点击
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        px: 2,
      }}
    >
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 25,
            }}
            style={{ pointerEvents: 'auto' }}
          >
            <Paper
              elevation={0}
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: { xs: 1.5, md: 2 },
                pl: { xs: 2, md: 3 },
                pr: { xs: 1, md: 1.5 },
                borderRadius: '100px', // 完美的胶囊形状
                background:
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(145deg, rgba(30,30,30,0.85) 0%, rgba(20,20,20,0.95) 100%)'
                    : 'linear-gradient(145deg, rgba(255,255,255,0.85) 0%, rgba(240,240,240,0.95) 100%)',
                backdropFilter: 'blur(40px) saturate(250%)',
                WebkitBackdropFilter: 'blur(40px) saturate(250%)',
                border: `1px solid ${alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.1 : 0.05)}`,
                borderTop: `1px solid ${alpha(theme.palette.common.white, theme.palette.mode === 'dark' ? 0.2 : 0.5)}`,
                boxShadow: theme.palette.mode === 'dark'
                  ? `0 20px 40px -10px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1)`
                  : `0 20px 40px -10px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)`,
                overflow: 'hidden',
                // Noise 特效贴图
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  background:
                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
                  opacity: theme.palette.mode === 'dark' ? 0.04 : 0.02,
                  pointerEvents: 'none',
                  mixBlendMode: 'overlay',
                },
              }}
            >
              {/* 会呼吸的星光图标 */}
              <Box
                sx={{
                  position: 'relative',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {/* 发光模糊背景 */}
                <Box
                  component={motion.div}
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  sx={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: theme.palette.text.primary,
                    filter: 'blur(12px)',
                    zIndex: 0,
                  }}
                />
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  style={{ zIndex: 1, display: 'flex' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                      fill={theme.palette.text.primary}
                    />
                  </svg>
                </motion.div>
              </Box>

              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', pr: 1 }}>
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: '0.05em',
                    lineHeight: 1.2,
                    textTransform: 'uppercase',
                  }}
                >
                  INSTALL GALLERY
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 400,
                    letterSpacing: '0.02em',
                  }}
                >
                  Get the immersive App experience.
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ position: 'relative', zIndex: 2 }}>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    size="small"
                    onClick={handleInstallClick}
                    sx={{
                      minWidth: 'auto',
                      borderRadius: '100px',
                      px: 2.5,
                      py: 0.8,
                      color: theme.palette.mode === 'dark' ? '#000' : '#fff',
                      bgcolor: theme.palette.text.primary,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      boxShadow: `0 4px 12px ${alpha(theme.palette.text.primary, 0.2)}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        bgcolor: theme.palette.text.primary,
                        boxShadow: `0 6px 16px ${alpha(theme.palette.text.primary, 0.4)}`,
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    GET
                  </Button>
                </motion.div>
                
                <Tooltip title="Not now">
                  <IconButton
                    size="small"
                    onClick={handleDismiss}
                    sx={{
                      color: 'text.secondary',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        color: 'text.primary',
                        bgcolor: alpha(theme.palette.text.primary, 0.05),
                      },
                    }}
                  >
                    <Close fontSize="small" sx={{ fontSize: '1.2rem' }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  );
};

export default PWAInstallPrompt;
