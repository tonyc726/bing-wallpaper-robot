import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LayoutGroup, AnimatePresence, motion } from 'framer-motion';
import {
  Typography,
  Box,
  CssBaseline,
  ThemeProvider,
  CircularProgress,
  LinearProgress,
  Fab,
  useScrollTrigger,
  Zoom,
  Snackbar,
  Button,
  IconButton,
  Card,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CloseIcon from '@mui/icons-material/Close';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import WallpaperGrid from './components/WallpaperGrid';
import ImageDialog from './components/ImageDialog';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import type { IndexData, WallpaperData } from './types';
import { initDataLoader, fetchIndexData, fetchChunksBatch, getCacheStatus } from './dataLoader';
import { swRegister } from './utils/swRegister';
import { lightTheme, darkTheme } from './theme';

// 滚动回顶按钮组件
function ScrollTop(props: { children: React.ReactElement }) {
  const { children } = props;
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 400, // 向下滚动 400px 后展示
  });

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (
      (event.target as HTMLDivElement).ownerDocument || document
    ).querySelector('#back-to-top-anchor');

    if (anchor) {
      anchor.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: { xs: 24, md: 32 }, right: { xs: 24, md: 32 }, zIndex: 1200 }}
      >
        {children}
      </Box>
    </Zoom>
  );
}

function App() {
  // ========== 状态管理 ==========
  // URL 同步主要由下层组件接管，顶层通过原生 URLParams 读取初始直达意图

  // 在渲染前立刻读取 URL 参数，并存入稳定 ref，避免异步初始化中闭包读不到 state 的问题
  const initialUrlIntent = useRef({
    sharedId: new URLSearchParams(window.location.search).get('id'),
    targetMonth: new URLSearchParams(window.location.search).get('month'),
  });
  
  const [indexData, setIndexData] = useState<IndexData | null>(null);
  const [wallpaperData, setWallpaperData] = useState<Map<string, WallpaperData[]>>(new Map());
  const [loadingMonths, setLoadingMonths] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoadingAllData, setIsLoadingAllData] = useState(false); // 全量数据加载中（搜索触发）
  const isInitializedRef = useRef(false);

  // 主题
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const currentTheme = darkMode ? darkTheme : lightTheme;

  const handleThemeToggle = useCallback((newVal?: boolean) => {
    setDarkMode((prev: boolean) => {
      const target = newVal !== undefined ? newVal : !prev;
      localStorage.setItem('darkMode', JSON.stringify(target));
      return target;
    });
  }, []);

  // === 遗留数据清理 ===
  // 彻底清除残留的收藏数据，满足激进清理的需求
  useEffect(() => {
    localStorage.removeItem('favorites');
  }, []);

  // 图片查看
  const [selectedImage, setSelectedImage] = useState<WallpaperData | null>(null);
  // 【新增】图片所在的当前上下文（搜索结果/过滤结果），代替全局 allWallpapers
  const [activeContextWallpapers, setActiveContextWallpapers] = useState<WallpaperData[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeSharedId, setActiveSharedId] = useState<string | null>(null);

  // PWA 更新提示
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // 稳定的gridData引用：直接映射整份 indexData.monthList 作为 DOM 渲染框架
  const gridData = useMemo(() => {
    if (!indexData) return [];
    const data = indexData.monthList.map((month) => ({
      groupMonth: month,
      wallpapers: wallpaperData.get(month) || [],
      // 从 index 注入当前月份的预期数量，供骨架屏占位使用
      totalCount: indexData.chunks[month]?.recordCount || 0,
    }));
    const totalCount = data.reduce((sum, group) => sum + group.wallpapers.length, 0);
    console.log(
      `[App] Memoized gridData: months=${data.length}, loaded_wallpapers=${totalCount}`,
    );
    return data;
  }, [indexData, wallpaperData]);

  // ========== 初始化 ==========
  useEffect(() => {
    // 防止 React.StrictMode 导致重复初始化
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      initializeApp();
    }

    // 监听 SW 更新事件
    const handleSWUpdate = () => {
      console.log('[App] SW Update available event received');
      setShowUpdateNotification(true);
    };

    window.addEventListener('sw-update-available', handleSWUpdate);
    return () => window.removeEventListener('sw-update-available', handleSWUpdate);
  }, []); // 空依赖数组，只运行一次

  // ========== 本地存储同步 ==========
  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const handleUpdateApp = useCallback(() => {
    const updateWorker = swRegister.getUpdateWorker();
    if (updateWorker) {
      updateWorker(true);
    } else {
      window.location.reload();
    }
  }, []);

  /**
   * 初始化应用
   */
  const initializeApp = async () => {
    const log = (...args: unknown[]) => console.log(`[${new Date().toISOString()}]`, ...args);

    try {
      setInitializing(true);
      log('%c🚀 ===== Bing Wallpaper System v4.0 =====', 'color: #2196F3; font-weight: bold; font-size: 16px');
      log('%c📊 System Information:', 'color: #4CAF50; font-weight: bold');
      log(`   - Platform: ${navigator.platform}`);
      log(`   - User Agent: ${navigator.userAgent.substring(0, 100)}...`);
      log(
        `   - Memory: ${performance.memory?.usedJSHeapSize ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB' : 'N/A'}`,
      );
      log(`   - Storage: Available`);
      log('');

      // 1. 初始化数据加载器（IndexedDB）
      log('%c🔌 Step 1/4: Initializing Data Loader', 'color: #FF9800; font-weight: bold');
      const dbStart = Date.now();
      await initDataLoader();
      log(`✅ Data Loader initialized in ${Date.now() - dbStart}ms`);

      // 1.5. 检查数据库状态
      log('%c💾 Step 2/4: Database Status', 'color: #FF9800; font-weight: bold');
      const cacheStatus = getCacheStatus();
      log(`   - Memory Cache: ${cacheStatus.memoryCache.size}/${cacheStatus.memoryCache.max}`);
      if (cacheStatus.lruCache) {
        log(`   - LRU Cache: ${cacheStatus.lruCache.size}/${cacheStatus.lruCache.max}`);
      }

      // 1.9. 注册 Service Worker
      log('%c📡 Step 3/4: Registering Service Worker', 'color: #FF9800; font-weight: bold');
      await swRegister.register();
      log('✅ Service Worker initialization completed');

      // 2. 获取索引数据
      log('%c📄 Step 4/4: Fetching Index Data', 'color: #FF9800; font-weight: bold');
      const indexStart = Date.now();
      const index = await fetchIndexData();
      setIndexData(index);
      log(`✅ Index loaded in ${Date.now() - indexStart}ms`);
      log(`   - Total wallpapers: ${index.totalWallpapers}`);
      log(`   - Total months: ${Object.keys(index.chunks).length}`);
      log(`   - Latest month: ${index.latestMonth}`);
      log(`   - Oldest month: ${index.oldestMonth}`);
      log(`   - Data version: ${index.dataVersion}`);
      log(`   - Generated at: ${index.generatedAt}`);

      // 2.1 首屏按需加载（默认下载最近 3 个月数据）
      log('%c📦 Loading Initial Data', 'color: #9C27B0; font-weight: bold');
      const initialMonths = index.monthList.slice(0, 3);
      
      // 5. [新增] Deep Link (直达链接) 拦截与全量预加载
      // 注意：不在此处直接调用 handleDeepLink/scrollIntoView，
      // 因为 initializeApp 是普通函数闭包，此时 React state 中的 indexData/wallpaperData 仍为 null。
      // 真正的 Deep Link 唤起由下方的 useEffect 在 loading===false 时负责触发。
      const targetMonth = initialUrlIntent.current.targetMonth;
      
      if (targetMonth && index.monthList.includes(targetMonth) && !initialMonths.includes(targetMonth)) {
         log(`%c🔗 Deep Link Month Detected: ${targetMonth}, injecting to initial load.`, 'color: #E91E63; font-weight: bold');
         initialMonths.push(targetMonth);
      }

      if (initialUrlIntent.current.sharedId) {
        log(`%c🔗 Deep Link ID Detected: ${initialUrlIntent.current.sharedId} — will trigger after state settles.`, 'color: #E91E63; font-weight: bold');
      }

      log(`   - Months: ${initialMonths.length} total`);

      // 4. 批量加载首屏数据
      const loadStart = Date.now();
      await loadInitialData(initialMonths);
      const loadDuration = Date.now() - loadStart;

      log('');
      log('%c🎉 ===== Initialization Complete! =====', 'color: #4CAF50; font-weight: bold; font-size: 16px');
      log(`⏱️  Total initialization time: ${loadDuration}ms`);
      log(`💾 Database mode: v4.0 (hybrid flattened)`);
      log(`🚀 Ready for user interaction!`);
      log('');
    } catch (error) {
      log('');
      log('%c❌ ===== Initialization Failed! =====', 'color: #F44336; font-weight: bold; font-size: 16px');
      log(`Error: ${error instanceof Error ? error.message : error}`);
      log(`Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
      console.error('Full error details:', error);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  };

  /**
   * 加载初始数据
   */
  const loadInitialData = async (months: string[]) => {
    setLoadingProgress(10);

    const expectedVersions = new Map<string, string>();
    for (const m of months) {
      if (indexData?.chunks[m]) {
        expectedVersions.set(m, indexData.chunks[m].version);
      }
    }

    const dataMap = await fetchChunksBatch(months, (loaded, total) => {
      setLoadingProgress(10 + (loaded / total) * 90);
    }, undefined, expectedVersions);

    setWallpaperData(dataMap);
  };

  /**
   * 被 WallpaperGrid 的 IntersectionObserver 调用的按需加载回调
   */
  const loadMonthData = useCallback(async (month: string) => {
    if (!indexData || wallpaperData.has(month) || loadingMonths.has(month)) return;

    // 标记为加载中，防止重复触发
    setLoadingMonths(prev => new Set(prev).add(month));
    
    try {
      const expectedVersions = new Map<string, string>();
      expectedVersions.set(month, indexData.chunks[month]?.version);
      
      const newMap = await fetchChunksBatch([month], undefined, undefined, expectedVersions);
      setWallpaperData(prev => {
        const next = new Map(prev);
        for (const [m, data] of newMap.entries()) {
          next.set(m, data);
        }
        return next;
      });
    } catch (e) {
      console.error(`[App] Failed to load data for month: ${month}`, e);
    } finally {
      setLoadingMonths(prev => {
        const next = new Set(prev);
        next.delete(month);
        return next;
      });
    }
  }, [indexData, wallpaperData, loadingMonths]);

  const isGlobalFetching = useRef(false);

  /**
   * 按需触发的全局极速加载（当进入非 Timeline 过滤或排序模式时触发）
   */
  const loadAllData = useCallback(async (): Promise<Map<string, WallpaperData[]> | undefined> => {
    if (!indexData) return;
    if (wallpaperData.size >= indexData.monthList.length) return wallpaperData; // 已经加载完毕
    if (isGlobalFetching.current) return;

    isGlobalFetching.current = true;
    setIsLoadingAllData(true); // 告知搜索组件：全量数据正在加载，请展示 loading 而非空状态
    
    try {
      const { fetchAllData } = await import('./dataLoader');
      const allWallpapers = await fetchAllData();
      
      const groupedData = new Map<string, WallpaperData[]>();
      for (const w of allWallpapers) {
        const year = Math.floor(w.date / 10000);
        const month = Math.floor((w.date % 10000) / 100);
        const mm = month < 10 ? `0${month}` : `${month}`;
        const mKey = `${year}-${mm}`;
        
        if (!groupedData.has(mKey)) groupedData.set(mKey, []);
        groupedData.get(mKey)!.push(w);
      }
      
      setWallpaperData(groupedData);
      return groupedData;
    } catch (e) {
      console.error(`[App] Failed to load all data.`, e);
      return undefined;
    } finally {
      isGlobalFetching.current = false;
      setIsLoadingAllData(false);
    }
  }, [indexData, wallpaperData.size]);

  /**
   * 处理图片点击
   */
  const handleImageClick = useCallback(
    (wallpaper: WallpaperData, contextWallpapers: WallpaperData[]) => {
      if (!indexData) return;

      setActiveSharedId(wallpaper.id); // Enable shared layout origin exclusively for the clicked image
      
      const index = contextWallpapers.findIndex((w) => w.id === wallpaper.id);
      setActiveContextWallpapers(contextWallpapers);
      setCurrentImageIndex(index >= 0 ? index : 0);
      setSelectedImage(wallpaper);
    },
    [indexData, setActiveSharedId],
  );

  /**
   * Dialog 导航回调
   */
  const handleDialogClose = useCallback(() => {
    setSelectedImage((prev) => {
      if (prev) setActiveSharedId(prev.id);
      return null;
    });
  }, []);

  const handleDialogPrevious = useCallback(() => {
    setCurrentImageIndex((prevIndex) => {
      if (prevIndex > 0) {
        setActiveSharedId('NONE');
        const newIndex = prevIndex - 1;
        setSelectedImage(activeContextWallpapers[newIndex]);
        return newIndex;
      }
      return prevIndex;
    });
  }, [activeContextWallpapers]);

  const handleDialogNext = useCallback(() => {
    setCurrentImageIndex((prevIndex) => {
      if (prevIndex < activeContextWallpapers.length - 1) {
        setActiveSharedId('NONE');
        const newIndex = prevIndex + 1;
        setSelectedImage(activeContextWallpapers[newIndex]);
        return newIndex;
      }
      return prevIndex;
    });
  }, [activeContextWallpapers]);

  /**
   * 处理直达分享链接的深潜唤起
   * 使用 useCallback 确保可安全作为 useEffect 依赖
   */
  const handleDeepLink = useCallback(async (targetId: string) => {
    // 强制获取全量数据（因为它一定带有图片所属列表上下文）
    let targetMap = wallpaperData;
    if (targetMap.size < (indexData?.monthList.length || 0)) {
      setLoading(true); // 唤起小绿条遮蔽，保证体验连贯
      const fullData = await loadAllData();
      if (fullData) targetMap = fullData;
      setLoading(false);
    }
    
    // 从字典中打平以进行查找
    const flatPool = Array.from(targetMap.values()).flat();
    const wp = flatPool.find(w => w.id === targetId);
    
    if (wp) {
      // 通过构造一个含有它所在的全局上下文来直接唤醒展示
      handleImageClick(wp, flatPool);
      
      // 抹除 URL 参数，避免刷新再次触发（不插入历史记录）
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({path: newUrl}, '', newUrl);
    }
  }, [wallpaperData, indexData, loadAllData, handleImageClick]);

  // ========== Deep Link 触发（在数据加载完成后） ==========
  // 🔑 关键修复：React 的 setState 是异步的。
  // initializeApp 中调用 handleDeepLink 时 indexData/wallpaperData 在闭包里仍为 null。
  // 必须等 loading===false 且 indexData 已进入 state 后再触发 Deep Link。
  useEffect(() => {
    if (!loading && indexData) {
      const { sharedId, targetMonth } = initialUrlIntent.current;

      if (sharedId) {
        handleDeepLink(sharedId);
        initialUrlIntent.current.sharedId = null; // 消费后清空，防止重复触发
      }

      if (targetMonth) {
        setTimeout(() => {
          const anchor = document.getElementById(
            `month-${targetMonth.replace(/年|月/g, '').replace(/\./g, '-')}`
          );
          if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
        initialUrlIntent.current.targetMonth = null; // 消费后清空
      }
    }
  }, [loading, indexData]); // handleDeepLink 依赖 wallpaperData/indexData，loading 变化时已是最新值

  /**
   * 键盘快捷键
   */
  useEffect(() => {
    const handleKeyDown = () => {
      // reserved for future shortcuts
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * 监听网络状态
   */
  useEffect(() => {
    const handleOnline = () => {
      console.log('[App] 网络已连接');
    };

    const handleOffline = () => {
      console.log('[App] 网络已断开');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ========== 渲染 ==========

  // 加载中
  if (initializing || loading) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: currentTheme.palette.gradients?.overlay?.[currentTheme.palette.mode] ?? (
              currentTheme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            ),
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* 装饰性光晕 */}
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              position: 'absolute',
              width: 400,
              height: 400,
              borderRadius: '50%',
              background: currentTheme.palette.accent?.main ?? currentTheme.palette.primary.main,
              filter: 'blur(100px)',
              top: '30%',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ textAlign: 'center' }}>
              {/* 动画加载图标 */}
              <motion.div
                animate={{
                  rotate: 360,
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              >
                <CircularProgress
                  size={60}
                  sx={{
                    color: currentTheme.palette.primary.main,
                    '& .MuiCircularProgress-circle': {
                      strokeLinecap: 'round',
                    },
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    color: 'text.primary',
                    mt: 3,
                    fontWeight: 500,
                    letterSpacing: '0.05em',
                  }}
                >
                  正在准备壁纸画廊
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                transition={{ delay: 0.5 }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    mt: 1,
                  }}
                >
                  稍等片刻，马上就好
                </Typography>
              </motion.div>

              {loadingProgress > 0 && loadingProgress < 100 && (
                <motion.div
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Box sx={{ width: 240, mt: 3 }}>
                    <LinearProgress
                      variant="determinate"
                      value={loadingProgress}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.1)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 2,
                        },
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        mt: 0.5,
                        display: 'block',
                      }}
                    >
                      {Math.round(loadingProgress)}%
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </Box>
          </motion.div>
        </Box>
      </ThemeProvider>
    );
  }

  // 数据不可用
  if (!indexData) {
    return (
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            background: currentTheme.palette.gradients?.overlay?.[currentTheme.palette.mode] ?? (
              currentTheme.palette.mode === 'dark'
                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                : 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            ),
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* 装饰性圆形 - 左侧 */}
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 0.3, x: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: currentTheme.palette.accent?.main ?? currentTheme.palette.primary.main,
              filter: 'blur(80px)',
              left: -50,
              top: '20%',
            }}
          />
          {/* 装饰性圆形 - 右侧 */}
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 0.2, x: 0 }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
            style={{
              position: 'absolute',
              width: 250,
              height: 250,
              borderRadius: '50%',
              background: currentTheme.palette.secondary.main,
              filter: 'blur(60px)',
              right: -30,
              bottom: '20%',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card
              sx={{
                maxWidth: 420,
                mx: 3,
                textAlign: 'center',
                p: 5,
                borderRadius: 4,
                boxShadow: currentTheme.palette.mode === 'dark'
                  ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                backdropFilter: 'blur(10px)',
                background: currentTheme.palette.backdrop?.card?.[currentTheme.palette.mode] ?? (
                  currentTheme.palette.mode === 'dark'
                    ? 'rgba(30, 30, 46, 0.8)'
                    : 'rgba(255, 255, 255, 0.85)'
                ),
              }}
            >
              <motion.div
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <CloudOffIcon
                  sx={{
                    fontSize: 80,
                    color: currentTheme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.7)'
                      : 'rgba(0, 0, 0, 0.5)',
                    mb: 3,
                  }}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 600,
                    color: 'text.primary',
                    mb: 1.5,
                    letterSpacing: '-0.02em',
                  }}
                >
                  无法加载数据
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    mb: 4,
                    lineHeight: 1.7,
                  }}
                >
                  似乎网络与我们失去了联系
                  <br />
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{ color: 'text.secondary', opacity: 0.7 }}
                  >
                    请检查您的网络连接后重试
                  </Typography>
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<RefreshIcon />}
                  onClick={() => window.location.reload()}
                  sx={{
                    borderRadius: 2.5,
                    px: 4,
                    py: 1.5,
                    fontWeight: 500,
                    textTransform: 'none',
                    boxShadow: 'none',
                    '&:hover': {
                      boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.2)',
                    },
                  }}
                >
                  重新加载
                </Button>
              </motion.div>
            </Card>
          </motion.div>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={currentTheme}>
      <LayoutGroup>
        <CssBaseline />

      {/* 主内容 - 真正的 Edge to Edge (消融边界) */}
      <Box sx={{ px: 0, py: 0, overflowX: 'hidden' }}>
        {/* ID 埋点用于返回顶部锚点 */}
        <div id="back-to-top-anchor" />
        <WallpaperGrid
          data={gridData}
          onImageClick={handleImageClick}
          indexData={indexData}
          loadingMonths={loadingMonths}
          loadMonthData={loadMonthData}
          loadAllData={loadAllData}
          isLoadingAllData={isLoadingAllData}
          activeSharedId={activeSharedId}
          darkMode={darkMode}
          setDarkMode={handleThemeToggle}
        />
      </Box>

      {/* 图片查看器 */}
      <AnimatePresence onExitComplete={() => setActiveSharedId(null)}>
        {selectedImage && (
          <ImageDialog
            wallpaper={selectedImage}
            allWallpapers={activeContextWallpapers}
            currentIndex={currentImageIndex}
            onClose={handleDialogClose}
            onPrevious={handleDialogPrevious}
            onNext={handleDialogNext}
          />
        )}
      </AnimatePresence>

      {/* 沉浸式返回顶部按钮 */}
      <ScrollTop>
        <Fab 
          size="small" 
          aria-label="scroll back to top"
          sx={{
            bgcolor: 'rgba(100, 100, 100, 0.3)',
            color: 'text.primary',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            '&:hover': {
              bgcolor: 'rgba(100, 100, 100, 0.5)',
            }
          }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      </ScrollTop>

      {/* PWA 安装提示 */}
      <PWAInstallPrompt />

      {/* PWA 更新提示 Snackbar */}
      <Snackbar
        open={showUpdateNotification}
        message="发现新版本或新数据"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        action={
          <>
            <Button color="secondary" size="small" onClick={handleUpdateApp}>
              更新
            </Button>
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={() => setShowUpdateNotification(false)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
        sx={{ bottom: { xs: 80, md: 24 } }} // 避开返回顶部按钮
      />
      </LayoutGroup>
    </ThemeProvider>
  );
}

export default App;
