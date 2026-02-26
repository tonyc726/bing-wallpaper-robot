/**
 * PWA 安装提示组件
 * 引导用户安装应用
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import type {
  SlideProps} from '@mui/material';
import {
  Box,
  Snackbar,
  Button,
  Slide,
  Typography,
  Paper,
  Stack,
  IconButton,
} from '@mui/material';
import { Download, Close, GetApp } from '@mui/icons-material';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt: () => Promise<void>;
}

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="up" />;
}

const PWAInstallPrompt: React.FC = () => {
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

  return (
    <Snackbar
      open={showInstallPrompt}
      onClose={handleDismiss}
      TransitionComponent={SlideTransition}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{
        '& .MuiSnackbarContent-root': {
          bgcolor: 'transparent',
          padding: 0,
          boxShadow: 'none',
        },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 2,
          p: 2,
          maxWidth: 400,
          mx: 2,
        }}
      >
        <Box display="flex" alignItems="flex-start" gap={2}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <GetApp sx={{ color: 'white', fontSize: 28 }} />
          </Box>

          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" gutterBottom>
              安装 Bing 壁纸
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              安装应用到主屏幕，享受更快的访问速度和离线浏览功能！
            </Typography>

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                onClick={handleDismiss}
                sx={{ minWidth: 'auto' }}
              >
                稍后
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleInstallClick}
                startIcon={<Download />}
              >
                安装
              </Button>
            </Stack>
          </Box>

          <IconButton
            size="small"
            onClick={handleDismiss}
            sx={{ alignSelf: 'flex-start' }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      </Paper>
    </Snackbar>
  );
};

export default PWAInstallPrompt;
