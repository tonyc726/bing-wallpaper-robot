import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  alpha,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CloseIcon from '@mui/icons-material/Close';
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

  // 稳定 ref：让 loadAllData 能读到最新 wallpaperData，而不把它加入 useCallback 依赖
  const wallpaperDataRef = useRef(wallpaperData);
  wallpaperDataRef.current = wallpaperData;

  // 整个生命周期只全量加载一次的 flag
  const isAllDataLoaded = useRef(false);

  // 主题
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : true;
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

  // PWA 更新提示
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);

  // Fix 3: 使用衍生 key（月份集合 + 各月数量）替代 Map 引用作为 dep，避免每次 new Map() 都重算
  const wallpaperDataKey = useMemo(
    () => `${wallpaperData.size}:${Array.from(wallpaperData.entries())
      .map(([m, arr]) => `${m}=${arr.length}`)
      .join(',')}`,
    [wallpaperData]
  );

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
  }, [indexData, wallpaperDataKey]);

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
      log('%c🚀 ===== Lumina Pavilion (拾影阁) v4.0 =====', 'color: #0078D4; font-weight: bold; font-size: 16px');
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

      // 1.9. 注册 Service Worker（fire-and-forget，不阻塞主流程）
      log('%c📡 Step 3/4: Registering Service Worker (async)', 'color: #FF9800; font-weight: bold');
      swRegister.register().then(() => {
        log('✅ Service Worker initialization completed (background)');
      }).catch((e: unknown) => {
        console.warn('[App] SW registration failed (non-fatal):', e);
      });

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

      // 4. 批量加载首屏数据（将 index 直接传入，避免闭包读到 null state）
      const loadStart = Date.now();
      await loadInitialData(initialMonths, index);
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
   * @param months 要加载的月份列表
   * @param index  直接传入 IndexData 对象，避免读取闭包中尚未更新的 React state
   */
  const loadInitialData = async (months: string[], index: IndexData) => {
    setLoadingProgress(10);

    const expectedVersions = new Map<string, string>();
    for (const m of months) {
      if (index.chunks[m]) {
        expectedVersions.set(m, index.chunks[m].version);
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
   *
   * Fix 1: 依赖数组只包含 indexData（初始化后不变）。
   *        通过 wallpaperDataRef.current 读取 wallpaperData 最新值，
   *        确保 useCallback 引用在整个生命周期内只创建一次，
   *        彻底切断 setWallpaperData → size 变化 → 回调重建 → useEffect 重触发的死循环。
   *
   * Fix 5: isAllDataLoaded ref 作为硬性终止条件，一旦全量数据加载成功，
   *        后续任何触发都直接返回缓存，不走 setWallpaperData。
   */
  const loadAllData = useCallback(async (): Promise<Map<string, WallpaperData[]> | undefined> => {
    if (!indexData) return;

    // Fix 5: 整个生命周期内最多执行一次全量加载
    if (isAllDataLoaded.current) return wallpaperDataRef.current;

    // Fix 4: 容错 guard（-2 容差），防止 all.js 和 index.json 月份数不一致
    if (wallpaperDataRef.current.size >= indexData.monthList.length - 2) {
      isAllDataLoaded.current = true;
      return wallpaperDataRef.current;
    }

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

      // Fix 2: 合并而非覆盖，并通过相同性检测跳过无意义的 re-render
      setWallpaperData(prev => {
        // 检测内容是否实质相同（月份集合 + 各月数量一致）
        if (prev.size === groupedData.size) {
          let identical = true;
          for (const [key, arr] of groupedData) {
            const existing = prev.get(key);
            if (!existing || existing.length !== arr.length) {
              identical = false;
              break;
            }
          }
          // 内容相同 → 返回原引用，React 将跳过这次 re-render
          if (identical) return prev;
        }
        // 合并：以 all.js 数据为基础，保留 chunk 中更新的月份数据
        const merged = new Map(groupedData);
        for (const [key, arr] of prev) {
          // 优先使用已有的增量加载数据（chunk 通常比 all.js 更新）
          if (!merged.has(key) || (merged.get(key)!.length < arr.length)) {
            merged.set(key, arr);
          }
        }
        return merged;
      });

      isAllDataLoaded.current = true;
      return groupedData;
    } catch (e) {
      console.error(`[App] Failed to load all data.`, e);
      return undefined;
    } finally {
      isGlobalFetching.current = false;
      setIsLoadingAllData(false);
    }
  // Fix 1: 只依赖 indexData，回调引用终身稳定
  }, [indexData]);

  /**
   * 处理图片点击
   */
  const handleImageClick = useCallback(
    (wallpaper: WallpaperData, contextWallpapers: WallpaperData[]) => {
      if (!indexData) return;
      const index = contextWallpapers.findIndex((w) => w.id === wallpaper.id);
      setActiveContextWallpapers(contextWallpapers);
      setCurrentImageIndex(index >= 0 ? index : 0);
      setSelectedImage(wallpaper);
    },
    [indexData],
  );

  /**
   * Dialog 导航回调
   */
  const handleDialogClose = useCallback(() => {
    // 将两个 setState 平齐放入同一批次，避免嵌套 updater 反模式
    setSelectedImage(null);
    setActiveContextWallpapers([]); // 释放内存：关闭后不需要保留上下文列表
  }, []);

  const handleDialogPrevious = useCallback(() => {
    setCurrentImageIndex((prevIndex) => {
      if (prevIndex > 0) {
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
    // ✅ 优先在已加载的数据中查找，避免触发 500KB 全量下载
    let targetMap = wallpaperData;
    let flatPool = Array.from(targetMap.values()).flat();
    let wp = flatPool.find((w) => w.id === targetId);

    if (!wp) {
      // 已加载数据中没有，才扩大范围加载全量
      setLoading(true);
      const fullData = await loadAllData();
      setLoading(false);
      if (fullData) {
        targetMap = fullData;
        flatPool = Array.from(targetMap.values()).flat();
        wp = flatPool.find((w) => w.id === targetId);
      }
    }

    if (wp) {
      handleImageClick(wp, flatPool);
    }
  }, [wallpaperData, loadAllData, handleImageClick]);

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
        // ✅ 使用 rAF 轮询等待目标 DOM 元素出现，替代固定 500ms 盲等
        const targetId = `month-${targetMonth.replace(/年|月/g, '').replace(/\./g, '-')}`;
        let rafAttempts = 0;
        const MAX_ATTEMPTS = 60; // 最多轮询 ~1s (每帧 ~16ms)
        const scrollWhenReady = () => {
          const anchor = document.getElementById(targetId);
          if (anchor) {
            anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (++rafAttempts < MAX_ATTEMPTS) {
            requestAnimationFrame(scrollWhenReady);
          }
        };
        requestAnimationFrame(scrollWhenReady);
        initialUrlIntent.current.targetMonth = null;
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
                  正在进入拾影阁…
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
                  光影加载中
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
            bgcolor: 'background.default',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* 故障艺术背景噪点层 */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: currentTheme.palette.mode === 'dark' ? 0.08 : 0.04,
              pointerEvents: 'none',
              background: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
              mixBlendMode: currentTheme.palette.mode === 'dark' ? 'screen' : 'multiply',
            }}
          />

          {/* 出血级背景文字水印 */}
          <Box
            component={motion.div}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: currentTheme.palette.mode === 'dark' ? 0.03 : 0.02, scale: 1 }}
            transition={{ duration: 2, ease: 'easeOut' }}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100%',
              textAlign: 'center',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            <Typography
              variant="h1"
              sx={{
                fontWeight: 900,
                fontSize: { xs: '8rem', sm: '15rem', md: '25rem' },
                lineHeight: 0.8,
                letterSpacing: '-0.05em',
                color: 'transparent',
                WebkitTextStroke: `2px ${currentTheme.palette.text.primary}`,
                textTransform: 'uppercase',
                fontFamily: '"Inter", "Helvetica", sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              LOST
            </Typography>
          </Box>

          <Box
            sx={{
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 3,
            }}
          >
            {/* 顶部的技术状态指示器 */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <Typography
                variant="overline"
                sx={{
                  letterSpacing: '0.3em',
                  color: currentTheme.palette.error.main,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 6,
                  fontFamily: '"JetBrains Mono", "Courier New", monospace',
                }}
              >
                <Box
                  component={motion.div}
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: currentTheme.palette.error.main,
                    boxShadow: `0 0 10px ${currentTheme.palette.error.main}`,
                  }}
                />
                ERROR_CODE: 404_NETWORK_LOST
              </Typography>
            </motion.div>

            {/* 极简故障艺术图标 */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: 'spring',
                stiffness: 100,
                damping: 20,
                delay: 0.3,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  mb: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* 环形断裂效果 */}
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <motion.circle
                    cx="40"
                    cy="40"
                    r="38"
                    stroke={currentTheme.palette.text.secondary}
                    strokeWidth="1"
                    strokeDasharray="4 8"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  />
                  <motion.path
                    d="M20 40H35M45 40H60M40 20V35M40 45V60"
                    stroke={currentTheme.palette.text.primary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    animate={{
                      opacity: [1, 0.4, 1],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />
                </svg>
              </Box>
            </motion.div>

            {/* 主标题 */}
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
              >
                <Typography
                  variant="h3"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: { xs: '0.1em', md: '0.2em' },
                    color: 'text.primary',
                    textTransform: 'uppercase',
                    mb: 2,
                    fontFamily: '"Inter", "Helvetica", sans-serif',
                  }}
                >
                  CONNECTION LOST
                </Typography>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 1 }}
              >
                <Typography
                  variant="body1"
                  sx={{
                    color: 'text.secondary',
                    fontWeight: 300,
                    letterSpacing: '0.05em',
                    maxWidth: 400,
                    mx: 'auto',
                    lineHeight: 1.8,
                  }}
                >
                  似乎网络与我们失去了联系。<br/>
                  请检查您的网络连接后重试。
                </Typography>
              </motion.div>
            </Box>

            {/* 磁性极简按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={() => window.location.reload()}
                sx={{
                  mt: 2,
                  px: 4,
                  py: 1.5,
                  color: 'text.primary',
                  border: `1px solid ${alpha(currentTheme.palette.text.primary, 0.2)}`,
                  borderRadius: 10,
                  background: 'transparent',
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    border: `1px solid ${currentTheme.palette.text.primary}`,
                    background: alpha(currentTheme.palette.text.primary, 0.05),
                    boxShadow: `0 0 20px ${alpha(currentTheme.palette.text.primary, 0.1)}`,
                  },
                }}
              >
                重新连接
              </Button>
            </motion.div>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={currentTheme}>
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
          darkMode={darkMode}
          setDarkMode={handleThemeToggle}
        />
      </Box>

      {/* 图片查看器 */}
      <AnimatePresence onExitComplete={() => {
        // 退场动画完成后才解冻背景滚动，避免在动画进行中触发大规模 Reflow
        document.body.style.overflow = '';
      }}>
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
    </ThemeProvider>
  );
}

export default App;
